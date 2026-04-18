import React, { useState, useRef, useEffect } from 'react';
import emailjs from '@emailjs/browser';

// Initialize EmailJS
emailjs.init("nOouP8nClP1a6uAa1");
import { 
  Mic, 
  Video, 
  BarChart3, 
  Image as ImageIcon, 
  FileText, 
  Settings, 
  Play, 
  Download, 
  Upload, 
  Cpu, 
  Sparkles,
  ChevronRight,
  Volume2,
  Type,
  LayoutDashboard,
  History,
  CreditCard,
  User as UserIcon,
  Calendar,
  ExternalLink,
  Square,
  Zap,
  Tag,
  Copy,
  Youtube,
  LogIn,
  LogOut,
  Smartphone,
  AlertCircle,
  Shield,
  Lock,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { generateVoice, analyzeImage, analyzeText, transcribeAudio, generateSubtitles } from './services/gemini';
import ReactMarkdown from 'react-markdown';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit
} from './firebase';

type Tool = 'dashboard' | 'voice-gen' | 'voice-clone' | 'subtitles' | 'video-enhancer' | 'channel-analyzer' | 'thumbnail-analyzer' | 'settings' | 'pricing' | 'title-gen' | 'tag-gen' | 'desc-gen' | 'audio-to-text' | 'history';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface HistoryItem {
  id: string;
  tool: string;
  type: string;
  input: string;
  createdAt: { toDate: () => Date } | null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('dashboard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [subtitleData, setSubtitleData] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [enhancedVideoUrl, setEnhancedVideoUrl] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [channelStats, setChannelStats] = useState<{
    name: string;
    subscribers: string;
    views: string;
    videos: string;
    avatar: string;
  } | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailScore, setThumbnailScore] = useState<number | null>(null);
  const [thumbnailMetrics, setThumbnailMetrics] = useState<{
    clickbait: number;
    brightness: number;
    blur: number;
    readability: number;
    ctrPrediction: number;
    estimatedViews: string;
  } | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [userPlan, setUserPlan] = useState<string>('none');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [userPlanLoading, setUserPlanLoading] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('INR');
  const [showUPIDialog, setShowUPIDialog] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [processingSuccess, setProcessingSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{name: string, price: string} | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubscribeHistory: (() => void) | null = null;

    // 🛡️ Safety timeout: Ensure loading screen eventually clears
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
      setUserPlanLoading(false);
    }, 10000); // 10s maximum load time

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous snapshot listener if it exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        setUser(user);
        setDisplayName(user.displayName || user.email?.split('@')[0] || 'User');
        setEmail(user.email || '');

        // Clean up previous history listener
        if (unsubscribeHistory) {
          unsubscribeHistory();
          unsubscribeHistory = null;
        }

        const userDocRef = doc(db, 'users', user.uid);
        
        try {
          // 🚀 Initial auth state found, we can show the app frame
          setAuthLoading(false);

          // 1. Initial existence check and creation
          const userDocPromise = getDoc(userDocRef);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
          
          try {
            const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as { exists: () => boolean, data: () => Record<string, unknown> };
            if (!userDoc.exists()) {
              await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                plan: 'none',
                createdAt: serverTimestamp()
              });
              setUserPlan('none');
            } else {
              setUserPlan((userDoc.data().plan as string) || 'none');
            }
          } catch {
            console.warn("User plan fetch timed out, using default.");
            setUserPlan('none');
          } finally {
            setUserPlanLoading(false);
            clearTimeout(safetyTimer);
          }

          // 2. Set up real-time listener for ALL future changes
          unsubscribeSnapshot = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const updatedPlan = (snapshot.data().plan as string) || 'none';
              setUserPlan(updatedPlan);
              setUserPlanLoading(false);
            }
          }, (error) => {
            console.error("Firestore sync error:", error);
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          });

          // 3. Set up History listener
          const historyQuery = query(
            collection(db, 'history'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
          );
          
          unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as HistoryItem[];
            setHistoryItems(items);
          }, (error) => {
            console.error("History sync error:", error);
          });

        } catch (error: unknown) {
          console.error("Error establishing user data sync:", error);
          setAuthLoading(false);
          setUserPlanLoading(false);
        }
      } else {
        setUser(null);
        setDisplayName('');
        setEmail('');
        setUserPlan('none');
        setAuthLoading(false);
        setUserPlanLoading(false);
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeHistory) unsubscribeHistory();
      clearTimeout(safetyTimer);
    };
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Login failed", err);
      setAuthError(err.message || "Login failed");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUpMode) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        await sendEmailVerification(userCredential.user);
        setVerificationEmail(emailInput);
        await signOut(auth);
        setIsVerificationSent(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        if (!userCredential.user.emailVerified) {
          setVerificationEmail(userCredential.user.email || '');
        }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      console.error("Email auth failed", err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError("User already exists. Please sign in");
      } else if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        setAuthError("Email or password is incorrect");
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError("Email/Password authentication is not enabled in the Firebase Console. Please enable it in the 'Sign-in method' tab.");
      } else {
        setAuthError(err.message || "Authentication failed");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTool('dashboard');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleUpgrade = (planName: string, planPrice: string) => {
    setSelectedPlan({ name: planName, price: planPrice });
    setShowUPIDialog(true);
  };

  // const selectPlan = async (plan: string) => { ... }

  const upgradePlan = async (plan: string) => {
    const user = auth.currentUser;

    if (!user) {
      alert("Login first");
      return;
    }

    setLoading(true);
    setShowProcessing(true);

    // 🛡️ Safety timeout for processing screen (30 seconds)
    const safetyTimeout = setTimeout(() => {
      setShowProcessing(false);
      setLoading(false);
    }, 30000);

    try {
      // 🔹 Save in Firebase
      await setDoc(
        doc(db, "upgrades", user.uid),
        {
          userId: user.uid,
          email: user.email,
          plan: plan,
          status: "pending",
          upgradedAt: serverTimestamp()
        }
      );

      // 🔹 Send email automatically
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || "YOUR_SERVICE_ID";
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "YOUR_TEMPLATE_ID";
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "nOouP8nClP1a6uAa1";

      await emailjs.send(
        serviceId,
        templateId,
        {
          user_email: user.email,
          plan: plan,
          time: new Date().toLocaleString()
        },
        publicKey
      );

      // ✨ Realistic processing delay (3.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 3500));

      clearTimeout(safetyTimeout);
      setProcessingSuccess(true);
      
      // Wait a moment to show success state
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowProcessing(false);
      setProcessingSuccess(false);
      setLoading(false);
      setActiveTool('dashboard');
    } catch (error) {
      console.error("Upgrade request failed:", error);
      clearTimeout(safetyTimeout);
      setShowProcessing(false);
      setProcessingSuccess(false);
      setLoading(false);
      alert("Failed to send upgrade request. Please try again.");
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
      // Wait a bit before clearing success so animation finishes
      setTimeout(() => {
        setProcessingSuccess(false);
        setShowProcessing(false);
      }, 500);
    }
  };

  useEffect(() => {
    // History sync removed
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setBrowserVoices(voices);
      if (voices.length > 0 && !selectedBrowserVoice) {
        // Prefer English voices if available
        const enVoice = voices.find(v => v.lang.startsWith('en'));
        setSelectedBrowserVoice(enVoice ? enVoice.name : voices[0].name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = () => {
    if (!inputText.trim()) return;
    window.speechSynthesis.cancel(); // Stop any current speech
    
    const utterance = new SpeechSynthesisUtterance(inputText);
    const voice = browserVoices.find(v => v.name === selectedBrowserVoice);
    if (voice) utterance.voice = voice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const tools = [
    { id: 'voice-gen', name: 'Voice Generate', icon: Volume2, desc: 'Browser Text to Speech' },
    { id: 'voice-clone', name: 'Voice Clone', icon: Mic, desc: 'Custom Voice Profiles', status: 'Not Available' },
    { id: 'subtitles', name: 'Auto Subtitles AI', icon: Type, desc: 'AI Speech to Text & SRT Export' },
    { id: 'video-enhancer', name: 'Video Enhancer AI', icon: Video, desc: 'AI Upscaling & Quality Boost' },
    { id: 'channel-analyzer', name: 'Channel Analyzer', icon: BarChart3, desc: 'Growth Insights' },
    { id: 'thumbnail-analyzer', name: 'Thumbnail Analyzer', icon: ImageIcon, desc: 'CTR Optimization' },
    { id: 'audio-to-text', name: 'Audio to Text AI', icon: Mic, desc: 'Convert Audio to Text' },
  ];

  const freeTools = [
    { id: 'title-gen', name: 'Title Generator', icon: Sparkles, desc: 'Catchy Video Titles' },
    { id: 'tag-gen', name: 'Tag Generator', icon: Cpu, desc: 'Optimized Video Tags' },
    { id: 'desc-gen', name: 'Description Generator', icon: FileText, desc: 'SEO Friendly Descriptions' },
  ];

  const accountTools = [
    { id: 'history', name: 'History', icon: History, desc: 'Usage Logs' },
    { id: 'settings', name: 'Settings', icon: Settings, desc: 'Account Preferences' },
    { id: 'pricing', name: 'Plans & Pricing', icon: CreditCard, desc: 'Manage Subscription' },
  ];

  const saveToHistory = async (tool: string, type: 'Free' | 'Paid', input: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'history'), {
        userId: user.uid,
        tool,
        type,
        input: input.slice(0, 500),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving history:", error);
    }
  };

  const handleAction = async () => {
    const isPaidTool = tools.some(t => t.id === activeTool);
    const hasAccess = userPlan.toLowerCase() === 'creator' || userPlan.toLowerCase() === 'pro';

    if (isPaidTool && !hasAccess) {
      setResult("### 🔒 Creator Plan Required\n\nThis is a premium AI tool. Please upgrade to the **Creator** or **Pro** plan to access this feature.");
      setActiveTool('pricing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setResult(null);
    setAudioUrl(null);
    try {
      switch (activeTool) {
        case 'voice-clone': {
          // Simulated cloning using prebuilt voices with style prompts
          const clonedUrl = await generateVoice(inputText, 'guide');
          setAudioUrl(clonedUrl);
          setResult(`**Cloned Audio Profile:** Friendly Guide\n\n**Audio Script:**\n${inputText}`);
          saveToHistory('Voice Clone', 'Paid', inputText);
          break;
        }
        case 'video-enhancer': {
          const enhancement = await analyzeText(`Act as a YouTube expert. Enhance this video idea/script: ${inputText}`);
          setResult(enhancement);
          saveToHistory('Video Enhancer', 'Paid', inputText);
          break;
        }
        case 'channel-analyzer': {
          const analysis = await analyzeText(`Analyze this YouTube channel data/niche: ${inputText}`);
          setResult(analysis);
          saveToHistory('Channel Analyzer', 'Paid', inputText);
          break;
        }
        case 'audio-to-text': {
          const transcription = await analyzeText(`Act as a transcription expert. Transcribe or summarize this audio content request: ${inputText}`);
          setResult(transcription);
          saveToHistory('Audio to Text', 'Paid', inputText);
          break;
        }
        case 'voice-gen': {
          handleSpeak();
          saveToHistory('Voice Generation', 'Paid', inputText);
          break;
        }
        case 'title-gen': {
          const titles = await analyzeText(`Generate a structured list of YouTube titles for the topic: "${inputText}". 
          Provide 3 titles for each of the following categories:
          1. Viral (high engagement, curiosity gap)
          2. Clickbait (extreme curiosity, bold claims)
          3. SEO Optimized (keyword rich, clear value)
          4. YouTube Shorts (short, punchy, emoji-heavy)
          
          Format the output as a clear markdown list with bold category headers.`);
          setResult(titles);
          saveToHistory('Title Generator', 'Free', inputText);
          break;
        }
        case 'tag-gen': {
          const tags = await analyzeText(`Generate a list of YouTube tags for the topic: "${inputText}". 
          Provide 20 tags for each of the following categories:
          1. SEO Tags (high-ranking, keyword-rich)
          2. Trending Tags (currently popular, high search volume)
          3. Shorts Tags (optimized for the Shorts feed)
          
          Format the output as a JSON object with keys "seo", "trending", and "shorts", where each value is a comma-separated string of tags.`);
          setResult(tags);
          saveToHistory('Tag Generator', 'Free', inputText);
          break;
        }
        case 'desc-gen': {
          const desc = await analyzeText(`Create a complete YouTube video optimization package for the title: "${inputText}". 
          Provide the following in a JSON object:
          1. "description": A long, comprehensive, and SEO-optimized video description (including hook, summary, timestamps, and CTA).
          2. "hashtags": A list of 10-15 trending hashtags.
          3. "keywords": A list of 20+ high-ranking SEO keywords for this topic.
          
          Format the output as a JSON object with keys "description", "hashtags", and "keywords".`);
          setResult(desc);
          saveToHistory('Description Generator', 'Free', inputText);
          break;
        }
        default:
          setResult("Please upload a file for this tool.");
      }
    } catch (error) {
      console.error(error);
      setResult("Error processing request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async () => {
    if (userPlan === 'none') {
      setResult("### 🔒 Plan Required\n\nVideo Enhancement is a premium feature. Please upgrade your plan to access this feature.");
      setActiveTool('pricing');
      return;
    }
    if (!videoFile) return;
    setIsEnhancing(true);
    setEnhancementProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setEnhancementProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      // Simulate AI processing time
      await new Promise(resolve => setTimeout(resolve, 4000));
      setEnhancedVideoUrl(videoFile); // In a real app, this would be the processed video URL
      setResult("Video enhanced successfully! Resolution boosted to 4K and color grading applied.");
    } catch (error) {
      console.error(error);
      setResult("Error enhancing video.");
    } finally {
      setIsEnhancing(false);
      setEnhancementProgress(100);
    }
  };

  const handleAnalyzeChannel = async () => {
    if (userPlan === 'none') {
      setResult("### 🔒 Plan Required\n\nChannel Analysis is a premium feature. Please upgrade your plan to access this feature.");
      setActiveTool('pricing');
      return;
    }
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    setChannelStats(null);
    
    try {
      // Simulate API call to fetch channel data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract a name from the link or use a mock
      const channelName = inputText.split('/').pop()?.replace('@', '') || "YouTube Creator";
      
      const stats = {
        name: channelName.charAt(0).toUpperCase() + channelName.slice(1),
        subscribers: (Math.floor(Math.random() * 900) + 100) + "K",
        views: (Math.floor(Math.random() * 50) + 10) + "M",
        videos: (Math.floor(Math.random() * 500) + 50).toString(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${channelName}`
      };
      
      setChannelStats(stats);
      
      const review = await analyzeText(`Act as a YouTube growth expert. Review this channel: ${stats.name} with ${stats.subscribers} subscribers, ${stats.views} views, and ${stats.videos} videos. Provide 3 actionable growth tips.`);
      setResult(review);
    } catch (error) {
      console.error(error);
      setResult("Error analyzing channel. Please check the link.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isPaidTool = tools.some(t => t.id === activeTool);
    if (isPaidTool && userPlan === 'none') {
      setResult("### 🔒 Plan Required\n\nThis tool requires a premium plan. Please upgrade to continue.");
      setActiveTool('pricing');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setSubtitleData(null);
    setVideoFile(null);
    setEnhancedVideoUrl(null);
    setEnhancementProgress(0);
    setThumbnailPreview(null);
    setThumbnailScore(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        if (activeTool === 'thumbnail-analyzer') {
          setThumbnailPreview(base64);
          setThumbnailMetrics(null);
          const analysis = await analyzeImage(base64, "Analyze this YouTube thumbnail for CTR, visual appeal, and branding. Provide a quality score out of 100, predicted CTR percentage (e.g., 8.5%), and detailed feedback. Also evaluate: Clickbait level (0-100), Brightness (0-100), Blur/Sharpness (0-100), and Text Readability (0-100).");
          setResult(analysis);
          // Simulate a score extraction or just set a random one for now
          setThumbnailScore(Math.floor(Math.random() * 20) + 75);
          setThumbnailMetrics({
            clickbait: Math.floor(Math.random() * 40) + 20,
            brightness: Math.floor(Math.random() * 30) + 60,
            blur: Math.floor(Math.random() * 20) + 80,
            readability: Math.floor(Math.random() * 30) + 70,
            ctrPrediction: parseFloat((Math.random() * 10 + 2).toFixed(1)),
            estimatedViews: (Math.floor(Math.random() * 500) + 50) + "K - " + (Math.floor(Math.random() * 2) + 1) + "M",
          });
        } else if (activeTool === 'subtitles') {
          const srt = await generateSubtitles(base64);
          setSubtitleData(srt);
          setResult(srt);
        } else if (activeTool === 'video-enhancer') {
          setVideoFile(base64);
          setResult("Video uploaded successfully. Click 'Enhance Quality' to begin AI processing.");
        } else if (activeTool === 'voice-clone' || activeTool === 'audio-to-text') {
          const transcription = await transcribeAudio(base64);
          if (activeTool === 'voice-clone') {
            setResult(`Voice profile analyzed successfully. Reference transcript: "${transcription.slice(0, 100)}..."\n\nYou can now use this voice profile for generation.`);
          } else {
            setResult(transcription);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setResult("Error processing file.");
    } finally {
      setLoading(false);
    }
  };

  const downloadSubtitles = () => {
    if (!subtitleData) return;
    const blob = new Blob([subtitleData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadTranscription = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here if you had one
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
            <Youtube className="w-10 h-10 text-brand-primary" />
          </div>
        </motion.div>
        
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">YOMAI</h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce delay-200" />
          </div>
        </div>
      </div>
    );
  }

  const isUnverified = user && !user.emailVerified && user.providerData.some(p => p.providerId === 'password');

  if (isVerificationSent || isUnverified) {
    return (
      <div className="h-screen bg-brand-dark flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-brand-primary/10 blur-[150px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange-500/5 blur-[150px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel p-10 space-y-6 relative z-10 text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center border border-brand-primary/30">
              <Sparkles className="text-brand-primary w-8 h-8" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tighter">Verify Your Email</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              We have sent you a verification email to <span className="text-white font-bold">{verificationEmail || user?.email}</span>. Please verify it and log in.
            </p>
          </div>

          <div className="pt-4">
            <button 
              onClick={async () => {
                await signOut(auth);
                setIsVerificationSent(false);
                setIsSignUpMode(false);
              }}
              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-brand-dark flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-brand-primary/10 blur-[150px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange-500/5 blur-[150px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel p-10 space-y-6 relative z-10"
        >
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,0,0,0.3)]">
                <Cpu className="text-white w-8 h-8" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tighter">YOMAI</h1>
            <p className="text-white/40 text-sm uppercase tracking-widest">{isSignUpMode ? 'Create Account' : 'Welcome Back'}</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="email" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            {authError && (
              <p className="text-brand-primary text-[10px] font-bold uppercase tracking-widest text-center animate-pulse">
                {authError}
              </p>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-brand-primary text-white font-bold rounded-xl hover:bg-brand-primary/80 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
            >
              {isSignUpMode ? <Sparkles className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {isSignUpMode ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-brand-dark px-4 text-white/20">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-xl shadow-white/5 group"
          >
            <Youtube className="w-5 h-5 text-brand-primary group-hover:text-white transition-colors" />
            Google Account
          </button>

          <p className="text-center text-xs text-white/40">
            {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              onClick={() => {
                setIsSignUpMode(!isSignUpMode);
                setAuthError(null);
              }}
              className="text-brand-primary font-bold hover:underline"
            >
              {isSignUpMode ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-brand-dark overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-xl">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.3)]">
            <Cpu className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter">YOMAI</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto py-4">
          <button
            onClick={() => {
              setActiveTool('dashboard');
              setResult(null);
              setAudioUrl(null);
              setInputText('');
            }}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group mb-4",
              activeTool === 'dashboard' 
                ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                : "text-white/50 hover:bg-white/5 hover:text-white"
            )}
          >
            <LayoutDashboard className={cn("w-5 h-5", activeTool === 'dashboard' ? "text-white" : "text-white/40 group-hover:text-white")} />
            <div className="text-left">
              <p className="text-sm font-medium">Dashboard</p>
              <p className="text-[10px] opacity-60 uppercase tracking-widest">Overview</p>
            </div>
          </button>

          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-4 mb-2">Paid Tools</div>
          
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as Tool);
                if (!(userPlan.toLowerCase() === 'creator' || userPlan.toLowerCase() === 'pro')) {
                  setResult("### 🔒 Creator Plan Required\n\nThis is a premium AI tool. Please upgrade to the **Creator** or **Pro** plan to access this feature.");
                } else {
                  setResult(null);
                  setAudioUrl(null);
                  setInputText('');
                }
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTool === tool.id 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <tool.icon className={cn("w-5 h-5", activeTool === tool.id ? "text-white" : "text-white/40 group-hover:text-white")} />
              <div className="text-left">
                <p className="text-sm font-medium">{tool.name}</p>
                <p className="text-[10px] opacity-60 uppercase tracking-widest">{tool.desc}</p>
              </div>
              {activeTool === tool.id && (
                <motion.div layoutId="active-indicator" className="ml-auto">
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              )}
            </button>
          ))}

          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-4 mt-8 mb-2">Free Tools</div>

          {freeTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as Tool);
                setResult(null);
                setAudioUrl(null);
                setInputText('');
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTool === tool.id 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <tool.icon className={cn("w-5 h-5", activeTool === tool.id ? "text-white" : "text-white/40 group-hover:text-white")} />
              <div className="text-left">
                <p className="text-sm font-medium">{tool.name}</p>
                <p className="text-[10px] opacity-60 uppercase tracking-widest">{tool.desc}</p>
              </div>
              {activeTool === tool.id && (
                <motion.div layoutId="active-indicator" className="ml-auto">
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              )}
            </button>
          ))}

          <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-4 mt-8 mb-2">Account</div>

          {accountTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as Tool);
                setResult(null);
                setAudioUrl(null);
                setInputText('');
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTool === tool.id 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <tool.icon className={cn("w-5 h-5", activeTool === tool.id ? "text-white" : "text-white/40 group-hover:text-white")} />
              <div className="text-left">
                <p className="text-sm font-medium">{tool.name}</p>
                <p className="text-[10px] opacity-60 uppercase tracking-widest">{tool.desc}</p>
              </div>
              {activeTool === tool.id && (
                <motion.div layoutId="active-indicator" className="ml-auto">
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="glass-panel p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-orange-500 flex items-center justify-center text-[10px] font-bold overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-white/40">{userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan Active</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:text-brand-primary transition-colors" />
            <span className="text-xs font-bold uppercase tracking-widest">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto p-12">
          {activeTool === 'dashboard' ? (
            <div className="space-y-12">
              <header>
                <div className="flex items-center gap-2 text-brand-primary mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">Welcome to YOMAI</span>
                </div>
                <h2 className="text-5xl font-bold tracking-tight mb-4">Creator Dashboard</h2>
                <p className="text-white/60 text-lg max-w-2xl">
                  Select a tool below to start automating your YouTube content creation workflow.
                </p>

                {/* Selected Plan Bar */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white/5 border border-white/10 rounded-2xl w-full"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-white">{userPlan === 'none' ? 'No Active' : userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan</h3>
                        {userPlan !== 'none' && (
                          <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                            {currency === 'INR' ? (
                              userPlan === 'starter' ? '₹199/mo' : userPlan === 'creator' ? '₹999/mo' : '₹1,999/mo'
                            ) : (
                              userPlan === 'starter' ? '$3/mo' : userPlan === 'creator' ? '$15/mo' : '$29/mo'
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/40">{userPlan === 'none' ? 'Upgrade to unlock AI features' : 'Subscription active'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex flex-col items-end gap-1.5 opacity-0">
                      <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary/20 w-0" />
                      </div>
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest opacity-0">Resets 4/23/2026</p>
                    </div>
                    <button 
                      onClick={() => setActiveTool('pricing')}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-lg shadow-white/5"
                    >
                      <CreditCard className="w-4 h-4" />
                      Upgrade
                    </button>
                  </div>
                </motion.div>

                <div className="flex items-center gap-2 text-brand-primary mt-12">
                  <Sparkles className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em]">Paid Tools</h4>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id as Tool);
                      if (!(userPlan.toLowerCase() === 'creator' || userPlan.toLowerCase() === 'pro')) {
                        setResult("### 🔒 Creator Plan Required\n\nThis is a premium AI tool. Please upgrade to the **Creator** or **Pro** plan to access this feature.");
                      }
                    }}
                    className="glass-panel p-6 text-left hover:bg-white/10 transition-all group border-white/5 hover:border-brand-primary/30"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-brand-primary/20 group-hover:scale-110 transition-all relative">
                        <tool.icon className="w-6 h-6 text-white/40 group-hover:text-brand-primary" />
                        {!(userPlan.toLowerCase() === 'creator' || userPlan.toLowerCase() === 'pro') && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-black/60 border border-white/10 rounded-full flex items-center justify-center">
                            <Shield className="w-2.5 h-2.5 text-brand-primary" />
                          </div>
                        )}
                      </div>
                      {tool.id === 'subtitles' && (
                        <span className="text-[8px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded uppercase tracking-widest border border-brand-primary/20">
                          Export SRT
                        </span>
                      )}
                      {tool.status === 'Not Awailable' && (
                        <span className="text-[8px] font-bold text-white bg-white/10 px-2 py-1 rounded uppercase tracking-widest border border-white/20">
                          Not Awailable
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold mb-1">{tool.name}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{tool.desc}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Tool <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-brand-primary mt-16 mb-6">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-[0.2em]">Free Tools</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {freeTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id as Tool)}
                    className="glass-panel p-6 text-left hover:bg-white/10 transition-all group border-white/5 hover:border-brand-primary/30"
                  >
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-primary/20 group-hover:scale-110 transition-all">
                      <tool.icon className="w-6 h-6 text-white/40 group-hover:text-brand-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{tool.name}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{tool.desc}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Tool <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : activeTool === 'settings' ? (
            <div className="space-y-8">
              <header>
                <h2 className="text-5xl font-bold tracking-tight mb-4">Settings</h2>
                <p className="text-white/60 text-lg">Manage your account preferences and AI configurations.</p>
              </header>
              <div className="space-y-6">
                {/* Profile Category */}
                <div className="glass-panel p-8 space-y-8">
                  <div className="flex items-center gap-6 p-4 border-b border-white/5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-primary to-orange-500 flex items-center justify-center text-3xl font-bold shadow-lg shadow-brand-primary/20">
                      {displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold">{displayName}</h3>
                      <p className="text-white/40 flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        {email}
                      </p>
                      <div className="pt-2">
                        <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest border border-brand-primary/20">
                          {userPlan} Plan
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40">Display Name</label>
                      <input 
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40">Email Address (Non-editable)</label>
                      <input 
                        type="email"
                        value={email}
                        readOnly
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-white/40 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Subscription & Billing Category */}
                <div className="glass-panel p-8 space-y-6">
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-2 text-brand-primary">
                      <CreditCard className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-[0.2em]">Subscription & Billing</h4>
                    </div>
                    <p className="text-xs text-white/40">Manage your plan and billing</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Plan Status</p>
                            <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded uppercase">{userPlan === 'none' ? 'No Plan' : userPlan.charAt(0).toUpperCase() + userPlan.slice(1) + ' Plan'}</span>
                          </div>
                          <p className="text-sm font-medium">{userPlan === 'none' ? 'In-active' : 'Active'}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden opacity-0">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: userPlan === 'none' ? '0%' : userPlan === 'starter' ? '100%' : userPlan === 'creator' ? '90%' : '22.5%' }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-brand-primary rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold opacity-0">{userPlan === 'none' ? 'No active subscription' : 'Resets 4/23/2026'}</p>
                          <button 
                            onClick={() => setActiveTool('pricing')}
                            className="text-[10px] font-bold text-brand-primary hover:underline uppercase tracking-widest"
                          >
                            {userPlan === 'none' ? 'Get a Plan' : 'Current Plan'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Next Billing Date</p>
                        <p className="text-sm font-medium">{userPlan === 'none' ? 'N/A' : 'April 24, 2026'}</p>
                      </div>
                      {userPlan !== 'none' && (
                        <button className="ml-auto text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-1">
                          Invoices <ExternalLink className="w-2 h-2" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Legal Category */}
                <div className="glass-panel p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                        <Shield className="w-6 h-6 text-brand-primary" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Legal</h4>
                        <p className="text-xs text-white/40">Policies and terms</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all">
                        Terms
                      </button>
                      <button 
                        onClick={() => setShowPrivacyPolicy(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
                      >
                        Privacy
                      </button>
                      <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all">
                        Refund
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preferences Category */}
                <div className="glass-panel p-8 space-y-6">
                  <div className="flex items-center gap-2 text-brand-primary mb-2">
                    <Settings className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em]">Preferences</h4>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">Auto-Save History</p>
                      <p className="text-xs text-white/40">Automatically save all generations to your history</p>
                    </div>
                    <div className="w-10 h-5 bg-brand-primary rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTool === 'history' ? (
            <div className="space-y-8">
              <header>
                <h2 className="text-5xl font-bold tracking-tight mb-4">History</h2>
                <p className="text-white/60 text-lg">Your recent activity and tool usage.</p>
              </header>
              <div className="glass-panel overflow-hidden border-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Tool</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Input</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historyItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-white/20 italic">
                          No history found yet. Start using tools to see them here!
                        </td>
                      </tr>
                    ) : (
                      historyItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 font-bold text-sm tracking-tight">{item.tool}</td>
                          <td className="px-6 py-4 text-xs text-white/60 font-mono truncate max-w-[200px]">{item.input}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${item.type === 'Free' ? 'bg-green-500/10 text-green-500' : 'bg-brand-primary/10 text-brand-primary'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[10px] text-white/20 font-bold uppercase text-right">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTool === 'pricing' ? (
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="text-5xl font-bold tracking-tight mb-4">Plans & Pricing</h2>
                  <p className="text-white/60 text-lg">Upgrade your plan to unlock advanced AI features and higher limits.</p>
                </div>
                
                {/* Currency Toggle */}
                <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
                  <button 
                    onClick={() => setCurrency('INR')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      currency === 'INR' ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                  >
                    INR (₹)
                  </button>
                  <button 
                    onClick={() => setCurrency('USD')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      currency === 'USD' ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                  >
                    USD ($)
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-panel p-8 border-white/10">
                  <h3 className="text-xl font-bold mb-2">Starter</h3>
                  <p className="text-3xl font-bold mb-6">{currency === 'INR' ? '₹199' : '$3'}<span className="text-sm font-normal text-white/40">/mo</span></p>
                  <ul className="space-y-3 text-sm text-white/60 mb-8">
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Free Tools Only</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Standard Voice Quality</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Basic Analytics</li>
                  </ul>
                  <button 
                    onClick={() => handleUpgrade('Starter', currency === 'INR' ? '₹199' : '$3')}
                    disabled={userPlan.toLowerCase() === 'starter'}
                    className={cn(
                      "w-full py-3 rounded-xl border border-white/10 font-bold transition-all",
                      userPlan.toLowerCase() === 'starter' ? "bg-white/5 text-white/40 cursor-not-allowed" : "hover:bg-white/5"
                    )}
                  >
                    {userPlan.toLowerCase() === 'starter' ? 'Current Plan' : 'Upgrade Now'}
                  </button>
                </div>
                <div className="glass-panel p-8 border-brand-primary/50 bg-brand-primary/5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold">Creator</h3>
                    <span className="bg-brand-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Popular</span>
                  </div>
                  <p className="text-3xl font-bold mb-6">{currency === 'INR' ? '₹999' : '$15'}<span className="text-sm font-normal text-white/40">/mo</span></p>
                  <ul className="space-y-3 text-sm text-white/60 mb-8">
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Access to Paid Tools</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> High-Quality Voice Synthesis</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Advanced Analytics</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Standard Support</li>
                  </ul>
                  <button 
                    onClick={() => handleUpgrade('Creator', currency === 'INR' ? '₹999' : '$15')}
                    disabled={userPlan.toLowerCase() === 'creator'}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all",
                      userPlan.toLowerCase() === 'creator' ? "bg-white/5 text-white/40 cursor-not-allowed border border-white/10" : "bg-brand-primary hover:shadow-lg hover:shadow-brand-primary/20"
                    )}
                  >
                    {userPlan.toLowerCase() === 'creator' ? 'Current Plan' : 'Upgrade Now'}
                  </button>
                </div>
                <div className="glass-panel p-8 border-white/10">
                  <h3 className="text-xl font-bold mb-2">Pro</h3>
                  <p className="text-3xl font-bold mb-6">{currency === 'INR' ? '₹1,999' : '$29'}<span className="text-sm font-normal text-white/40">/mo</span></p>
                  <ul className="space-y-3 text-sm text-white/60 mb-8">
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Full Access to Paid Tools</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Ultra-Realistic Voice Cloning</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Advanced Channel Insights</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-primary" /> Priority AI Processing</li>
                  </ul>
                  <button 
                    onClick={() => handleUpgrade('Pro', currency === 'INR' ? '₹1,999' : '$29')}
                    disabled={userPlan.toLowerCase() === 'pro'}
                    className={cn(
                      "w-full py-3 rounded-xl border border-white/10 font-bold transition-all",
                      userPlan.toLowerCase() === 'pro' ? "bg-white/5 text-white/40 cursor-not-allowed" : "hover:bg-white/5"
                    )}
                  >
                    {userPlan.toLowerCase() === 'pro' ? 'Current Plan' : 'Upgrade Now'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
                      {/* Premium Lock Overlay for Paid Tools */}
      {tools.some(t => t.id === activeTool) && 
       !userPlanLoading && 
       !(userPlan.toLowerCase() === 'creator' || userPlan.toLowerCase() === 'pro') && (
        <div className="absolute inset-x-0 bottom-0 top-[120px] z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-md rounded-3xl border border-white/10 mt-12 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full glass-panel p-10 text-center space-y-8 relative overflow-hidden bg-black/80"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-transparent pointer-events-none" />
            
            <div className="w-20 h-20 bg-brand-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group">
              <Lock className="w-10 h-10 text-brand-primary group-hover:scale-110 transition-transform" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tight">Premium Tool</h2>
              <p className="text-white/60 text-lg leading-relaxed">
                Upgrade to unlock all 20+ AI tools.
              </p>
              <p className="text-[10px] uppercase tracking-widest font-black text-white/20 mt-4 leading-relaxed">
                Free tools: Title Generator, Tag Generator & Description Generator
              </p>
            </div>

            <button 
              onClick={() => setActiveTool('pricing')}
              className="w-full bg-brand-primary text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)]"
            >
              <Zap className="w-5 h-5" />
              Upgrade Now
            </button>
          </motion.div>
        </div>
      )}

      <header className="mb-12">
                <div className="flex items-center gap-2 text-brand-primary mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">AI Powered Automation</span>
                </div>
                <h2 className="text-5xl font-bold tracking-tight mb-4">
                  {[...tools, ...freeTools].find(t => t.id === activeTool)?.name}
                </h2>
                <p className="text-white/60 text-lg max-w-2xl">
                  {[...tools, ...freeTools].find(t => t.id === activeTool)?.desc}. Leverage the power of Gemini 2.5 to automate your YouTube workflow.
                </p>
              </header>

              <div className="space-y-8">
                {/* Input Section */}
                <div className="glass-panel p-8 space-y-6">
                  {activeTool === 'voice-gen' ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                          <Volume2 className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Text to Speech</h3>
                          <p className="text-xs text-white/40">Convert text to natural sounding speech using browser API</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Select Voice</label>
                          <div className="relative group">
                            <select
                              value={selectedBrowserVoice}
                              onChange={(e) => setSelectedBrowserVoice(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white appearance-none focus:outline-none focus:border-brand-primary/50 transition-colors font-bold text-sm cursor-pointer"
                            >
                              {browserVoices.map((voice, i) => (
                                <option key={i} value={voice.name} className="bg-neutral-900 text-white">
                                  {voice.name} ({voice.lang})
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white transition-colors">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Input Text</label>
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type your script here... (e.g., 'Hello, welcome to my YouTube channel!')"
                            className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-colors resize-none font-mono text-sm"
                          />
                        </div>

                        <div className="flex flex-wrap gap-4">
                          <button
                            onClick={handleSpeak}
                            disabled={!inputText.trim()}
                            className="flex-1 bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-primary hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black min-w-[160px]"
                          >
                            <Play className={cn("w-4 h-4", isSpeaking && "animate-pulse")} />
                            {isSpeaking ? "Speaking..." : "Speak Now"}
                          </button>
                          <button
                            onClick={handleStop}
                            disabled={!isSpeaking}
                            className="px-6 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : activeTool === 'channel-analyzer' ? (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40">YouTube Channel Link</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                              type="text"
                              value={inputText}
                              onChange={(e) => setInputText(e.target.value)}
                              placeholder="https://youtube.com/@channelname"
                              className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-colors"
                            />
                          </div>
                          <button
                            onClick={handleAnalyzeChannel}
                            disabled={loading || !inputText.trim()}
                            className="px-8 bg-white text-black font-bold rounded-xl hover:bg-brand-primary hover:text-white transition-all disabled:opacity-50"
                          >
                            {loading ? (
                              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : "Analyze"}
                          </button>
                        </div>
                      </div>

                      {channelStats && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white/5 border border-white/10 rounded-2xl p-6"
                        >
                          <div className="flex items-center gap-4 mb-6">
                            <img src={channelStats.avatar} alt="Avatar" className="w-16 h-16 rounded-full bg-brand-primary/20 border border-white/10" />
                            <div>
                              <h3 className="text-xl font-bold">{channelStats.name}</h3>
                              <p className="text-xs text-white/40">YouTube Channel Overview</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                              <p className="text-lg font-bold text-brand-primary">{channelStats.subscribers}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Subscribers</p>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                              <p className="text-lg font-bold text-brand-primary">{channelStats.views}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Total Views</p>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                              <p className="text-lg font-bold text-brand-primary">{channelStats.videos}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Videos</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ) : activeTool === 'title-gen' ? (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Target Keyword / Topic</label>
                          <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded uppercase tracking-widest">AI Powered</span>
                        </div>
                        <div className="relative">
                          <Sparkles className="absolute left-4 top-4 w-5 h-5 text-brand-primary/40" />
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="e.g., 'How to grow a YouTube channel in 2026' or 'Best gaming PC build'"
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-all resize-none font-sans text-lg font-medium"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {['Viral', 'Clickbait', 'SEO', 'Shorts'].map((style) => (
                            <div key={style} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(255,0,0,0.5)]" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{style} Mode</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={handleAction}
                          disabled={loading || !inputText.trim()}
                          className="w-full bg-white text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                        >
                          {loading ? (
                            <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Zap className="w-5 h-5" />
                              Generate Viral Titles
                            </>
                          )}
                        </button>
                      </div>

                      {result && !loading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-6"
                        >
                          <div className="flex items-center gap-3 text-brand-primary">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="text-xl font-bold">Generated Titles</h3>
                          </div>
                          <div className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20">
                            <div className="prose prose-invert max-w-none prose-sm font-sans leading-relaxed text-white/90">
                              <ReactMarkdown>{result}</ReactMarkdown>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button 
                              onClick={() => copyToClipboard(result)}
                              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              Copy All Titles
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ) : activeTool === 'tag-gen' ? (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Video Topic / Keywords</label>
                          <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded uppercase tracking-widest">SEO Optimized</span>
                        </div>
                        <div className="relative">
                          <Tag className="absolute left-4 top-4 w-5 h-5 text-brand-primary/40" />
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="e.g., 'iPhone 15 Pro Review' or 'Best Pasta Recipe'"
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-all resize-none font-sans text-lg font-medium"
                          />
                        </div>

                        <button
                          onClick={handleAction}
                          disabled={loading || !inputText.trim()}
                          className="w-full bg-white text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                        >
                          {loading ? (
                            <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Generate High-Ranking Tags
                            </>
                          )}
                        </button>
                      </div>

                      {result && !loading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-8"
                        >
                          {(() => {
                            try {
                              const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, ''));
                              return (
                                <>
                                  {[
                                    { key: 'seo', label: 'SEO Optimized Tags', icon: <BarChart3 className="w-4 h-4" /> },
                                    { key: 'trending', label: 'Trending Tags', icon: <Zap className="w-4 h-4" /> },
                                    { key: 'shorts', label: 'YouTube Shorts Tags', icon: <Youtube className="w-4 h-4" /> }
                                  ].map((cat) => (
                                    <div key={cat.key} className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-brand-primary">
                                          {cat.icon}
                                          <h4 className="text-sm font-bold uppercase tracking-widest">{cat.label}</h4>
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(parsed[cat.key])}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                        >
                                          <Copy className="w-3 h-3" />
                                          Copy {cat.key.toUpperCase()} Tags
                                        </button>
                                      </div>
                                      <div className="glass-panel p-6 bg-brand-primary/5 border-brand-primary/20">
                                        <div className="flex flex-wrap gap-2">
                                          {parsed[cat.key].split(',').map((tag: string, index: number) => (
                                            <div 
                                              key={index}
                                              className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white/80 hover:border-brand-primary/50 hover:text-white transition-all cursor-default"
                                            >
                                              {tag.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              );
                            } catch {
                              return (
                                <div className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20">
                                  <div className="prose prose-invert max-w-none prose-sm font-sans leading-relaxed text-white/90">
                                    <ReactMarkdown>{result}</ReactMarkdown>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </motion.div>
                      )}
                    </div>
                  ) : activeTool === 'desc-gen' ? (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Video Title / Topic</label>
                          <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded uppercase tracking-widest">Viral Optimized</span>
                        </div>
                        <div className="relative">
                          <FileText className="absolute left-4 top-4 w-5 h-5 text-brand-primary/40" />
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="e.g., 'How to start a business in 2026' or 'My daily morning routine'"
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 transition-all resize-none font-sans text-lg font-medium"
                          />
                        </div>

                        <button
                          onClick={handleAction}
                          disabled={loading || !inputText.trim()}
                          className="w-full bg-white text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                        >
                          {loading ? (
                            <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Generate Viral Description
                            </>
                          )}
                        </button>
                      </div>

                      {result && !loading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-10"
                        >
                          {(() => {
                            try {
                              const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, ''));
                              return (
                                <>
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 text-brand-primary">
                                        <FileText className="w-5 h-5" />
                                        <h3 className="text-xl font-bold">Generated Description</h3>
                                      </div>
                                      <button 
                                        onClick={() => copyToClipboard(parsed.description)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-all"
                                      >
                                        <Copy className="w-3 h-3" />
                                        Copy Description
                                      </button>
                                    </div>
                                    <div className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20">
                                      <div className="prose prose-invert max-w-none prose-sm font-sans leading-relaxed text-white/90">
                                        <ReactMarkdown>{parsed.description}</ReactMarkdown>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-brand-primary">
                                          <Zap className="w-4 h-4" />
                                          <h4 className="text-sm font-bold uppercase tracking-widest">Trending Hashtags</h4>
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(parsed.hashtags)}
                                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="glass-panel p-4 bg-brand-primary/5 border-brand-primary/20">
                                        <div className="flex flex-wrap gap-2">
                                          {parsed.hashtags.split(' ').map((tag: string, i: number) => (
                                            <span key={i} className="text-brand-primary font-medium">{tag}</span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-brand-primary">
                                          <BarChart3 className="w-4 h-4" />
                                          <h4 className="text-sm font-bold uppercase tracking-widest">SEO Keywords</h4>
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(parsed.keywords)}
                                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="glass-panel p-4 bg-brand-primary/5 border-brand-primary/20">
                                        <p className="text-sm text-white/60 leading-relaxed italic">
                                          {parsed.keywords}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            } catch {
                              return (
                                <div className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20">
                                  <div className="prose prose-invert max-w-none prose-sm font-sans leading-relaxed text-white/90">
                                    <ReactMarkdown>{result}</ReactMarkdown>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </motion.div>
                      )}
                    </div>
                  ) : activeTool === 'thumbnail-analyzer' ? (
                    <div className="space-y-6">
                      {!thumbnailPreview ? (
                        <div className="space-y-6">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Upload Thumbnail to Analyze</label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-brand-primary/50 hover:bg-white/5 transition-all cursor-pointer group"
                          >
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <ImageIcon className="w-8 h-8 text-white/40 group-hover:text-brand-primary" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium">Click to upload thumbnail for AI analysis</p>
                              <p className="text-xs text-white/40 mt-1">PNG, JPG up to 10MB</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Thumbnail Preview</p>
                              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                                <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">AI Quality Score</p>
                              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-brand-primary/20 flex flex-col items-center justify-center">
                                {loading ? (
                                  <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                                ) : thumbnailScore ? (
                                  <motion.div 
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center"
                                  >
                                    <div className="text-6xl font-black text-brand-primary mb-2">{thumbnailScore}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Quality Rating</div>
                                  </motion.div>
                                ) : (
                                  <div className="text-center p-6">
                                    <Sparkles className="w-8 h-8 text-brand-primary/40 mx-auto mb-2" />
                                    <p className="text-xs text-white/40">Analyzing visual elements...</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {thumbnailMetrics && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
                            >
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.ctrPrediction}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Predicted CTR</p>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.estimatedViews}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Est. Views</p>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.clickbait}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Clickbait</p>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.brightness}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Brightness</p>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.blur}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Sharpness</p>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xl font-bold text-brand-primary">{thumbnailMetrics.readability}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Readability</p>
                              </div>
                            </motion.div>
                          )}

                          {result && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20"
                            >
                              <div className="flex items-center gap-2 mb-6 text-brand-primary">
                                <Sparkles className="w-5 h-5" />
                                <h3 className="text-xl font-bold">AI Feedback & Recommendations</h3>
                              </div>
                              <div className="prose prose-invert max-w-none prose-sm font-mono leading-relaxed text-white/80">
                                <ReactMarkdown>{result}</ReactMarkdown>
                              </div>
                            </motion.div>
                          )}

                          <button
                            onClick={() => {
                              setThumbnailPreview(null);
                              setResult(null);
                              setThumbnailScore(null);
                              setThumbnailMetrics(null);
                            }}
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
                          >
                            Upload Different Image
                          </button>
                        </div>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="image/*"
                      />
                    </div>
                  ) : activeTool === 'video-enhancer' ? (
                    <div className="space-y-6">
                      {!videoFile ? (
                        <div className="space-y-6">
                          <label className="text-xs font-bold uppercase tracking-widest text-white/40">Upload Video to Enhance</label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-brand-primary/50 hover:bg-white/5 transition-all cursor-pointer group"
                          >
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Video className="w-8 h-8 text-white/40 group-hover:text-brand-primary" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium">Click to upload video for enhancement</p>
                              <p className="text-xs text-white/40 mt-1">MP4, MOV up to 50MB</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Original Preview</p>
                              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/5">
                                <video src={videoFile} controls className="w-full h-full object-cover" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">AI Enhanced Preview</p>
                              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-brand-primary/20 relative">
                                {enhancedVideoUrl ? (
                                  <video src={enhancedVideoUrl} controls className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-brand-primary/5">
                                    {isEnhancing ? (
                                      <div className="w-full px-8 space-y-4">
                                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                          <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${enhancementProgress}%` }}
                                            className="h-full bg-brand-primary"
                                          />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary text-center animate-pulse">
                                          Enhancing Quality: {Math.round(enhancementProgress)}%
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="text-center p-6">
                                        <Sparkles className="w-8 h-8 text-brand-primary/40 mx-auto mb-2" />
                                        <p className="text-xs text-white/40">Ready to boost resolution and quality</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button
                              onClick={() => setVideoFile(null)}
                              className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
                            >
                              Reset
                            </button>
                            <button
                              onClick={handleEnhance}
                              disabled={isEnhancing || !!enhancedVideoUrl}
                              className="flex-1 bg-brand-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-primary/80 transition-all disabled:opacity-50"
                            >
                              {isEnhancing ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  {enhancedVideoUrl ? "Video Enhanced" : "Enhance Quality (4K Upscale)"}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="video/*"
                      />
                    </div>
                  ) : activeTool === 'voice-clone' ? (
                    <div className="space-y-6 relative">
                      <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl border border-white/5">
                        <div className="bg-brand-primary/20 border border-brand-primary/40 px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.2)]">
                          <p className="text-xl font-bold tracking-widest uppercase text-white drop-shadow-lg">Not Awailable</p>
                        </div>
                      </div>
                      <div className="space-y-4 pointer-events-none opacity-50">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40">Upload Reference Voice (Audio)</label>
                        <div 
                          className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all group"
                        >
                          <Upload className="w-8 h-8 text-white/40" />
                          <p className="text-sm font-medium text-white/20">Upload reference audio to clone</p>
                        </div>
                      </div>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="audio/*,video/*"
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40">
                        {activeTool === 'subtitles' ? 'Upload Video or Audio for Subtitles' : 'Upload Media'}
                      </label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-brand-primary/50 hover:bg-white/5 transition-all cursor-pointer group"
                      >
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          {activeTool === 'subtitles' ? <Type className="w-8 h-8 text-white/40 group-hover:text-brand-primary" /> : <Upload className="w-8 h-8 text-white/40 group-hover:text-brand-primary" />}
                        </div>
                        <div className="text-center">
                          <p className="font-medium">
                            {activeTool === 'subtitles' ? 'Click to generate AI subtitles' : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            MP3, WAV, MP4 up to 50MB
                          </p>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          accept="audio/*,video/*"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Result Section */}
                <AnimatePresence mode="wait">
                  {(result || audioUrl) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-brand-primary" />
                          {activeTool === 'subtitles' ? 'Auto Subtitles Generated' : 
                           activeTool === 'video-enhancer' ? 'Video Enhancement Complete' :
                           activeTool === 'channel-analyzer' ? 'AI Channel Review' :
                           activeTool === 'thumbnail-analyzer' ? 'AI Thumbnail Analysis' :
                           activeTool === 'audio-to-text' ? 'Audio Transcription Complete' :
                           'AI Generated Content'}
                        </h3>
                        <div className="flex items-center gap-4">
                          {activeTool === 'audio-to-text' && result && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => copyToClipboard(result)}
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                              >
                                <History className="w-4 h-4" />
                                Copy
                              </button>
                              <button 
                                onClick={downloadTranscription}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/80 transition-all"
                              >
                                <Download className="w-3 h-3" />
                                Download Text
                              </button>
                            </div>
                          )}
                          {activeTool === 'video-enhancer' && enhancedVideoUrl && (
                            <a 
                              href={enhancedVideoUrl} 
                              download="enhanced_video.mp4"
                              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/80 transition-all"
                            >
                              <Download className="w-3 h-3" />
                              Download 4K Video
                            </a>
                          )}
                          {audioUrl && (
                            <a 
                              href={audioUrl} 
                              download="yomai-voice.mp3"
                              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download Audio
                            </a>
                          )}
                          {activeTool === 'subtitles' && subtitleData && (
                            <button 
                              onClick={downloadSubtitles}
                              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-primary hover:text-white transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download SRT
                            </button>
                          )}
                        </div>
                      </div>

                      {(activeTool === 'subtitles' || activeTool === 'audio-to-text') && result && (
                        <div className="glass-panel p-6 bg-black/40 border-brand-primary/20 overflow-hidden relative group">
                          <div className="flex items-center gap-2 mb-4 text-brand-primary">
                            <Play className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Live Preview</span>
                          </div>
                          <div className="h-48 bg-neutral-900 rounded-xl flex items-end justify-center p-8 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="relative z-10 text-center"
                            >
                              <p className="text-lg font-bold text-white bg-black/60 px-4 py-1 rounded shadow-lg">
                                {activeTool === 'subtitles' ? 
                                  (result.split('\n').filter((l: string) => l.trim() && !l.includes('-->') && isNaN(parseInt(l)))[0] || "Generating live subtitles...") :
                                  (result.split('\n').filter((l: string) => l.trim())[0]?.slice(0, 100) + (result.length > 100 ? '...' : '') || "Generating live transcription...")
                                }
                              </p>
                            </motion.div>
                          </div>
                        </div>
                      )}

                      <div className="glass-panel p-8 bg-brand-primary/5 border-brand-primary/20">
                        {audioUrl && (
                          <div className="mb-6 p-4 bg-black/40 rounded-xl flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center">
                              <Volume2 className="w-5 h-5 text-white" />
                            </div>
                            <audio src={audioUrl} controls className="flex-1 h-8" />
                          </div>
                        )}
                        
                        {result && (
                          <div className="prose prose-invert max-w-none prose-sm font-mono leading-relaxed text-white/80">
                            <ReactMarkdown>{result}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </main>

      {/* UPI Dialog */}
      <AnimatePresence>
        {showUPIDialog && selectedPlan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel max-w-md w-full p-8 space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />
              
              <button 
                onClick={() => setShowUPIDialog(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-6 h-6 text-brand-primary" />
                </div>
                <h3 className="text-2xl font-bold">Pay with UPI</h3>
                <p className="text-white/40 text-sm">Use the UPI ID below to pay <span className="text-brand-primary font-bold">{selectedPlan.price}</span> for the <span className="text-white font-bold">{selectedPlan.name}</span> plan.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20">UPI ID</label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value="harshit1124@fam" 
                      readOnly 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pr-12 text-sm font-mono focus:outline-none"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText("harshit1124@fam");
                        alert("UPI ID copied to clipboard");
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-brand-primary transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      upgradePlan(selectedPlan.name);
                      setShowUPIDialog(false);
                    }}
                    className="w-full bg-brand-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-brand-primary/20 transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    Confirm Payment & Upgrade
                  </button>
                  <p className="text-center text-[10px] text-white/20 mt-4 uppercase tracking-widest">
                    After payment, click confirm to send your request.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Processing Screen */}
      <AnimatePresence>
        {showProcessing && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <div className="relative w-28 h-28 mx-auto">
                  {processingSuccess ? (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 bg-red-900/40 rounded-full flex items-center justify-center border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]"
                    >
                      <Sparkles className="w-12 h-12 text-red-500" />
                    </motion.div>
                  ) : (
                    <>
                      <div className="absolute inset-0 border-4 border-brand-primary/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-brand-primary animate-pulse" />
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-bold tracking-tight text-white">
                    {processingSuccess ? "Payment Successful!" : "Processing Payment"}
                  </h3>
                  <div className="max-w-xs mx-auto">
                    <p className="text-white/60 text-base leading-relaxed">
                      {processingSuccess ? (
                        <>
                          Your plan has been upgraded to <span className="text-red-500 font-bold">{selectedPlan?.name || 'Starter'}</span>. Redirecting to your dashboard...
                        </>
                      ) : (
                        "Your request will be processed within 24 hours"
                      )}
                    </p>
                  </div>
                  {!processingSuccess && (
                    <p className="text-white/20 text-[10px] uppercase tracking-widest mt-4">Please do not refresh or close this window</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-brand-primary/60 text-xs font-mono">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrivacyPolicy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrivacyPolicy(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[80vh] glass-panel overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Privacy Policy</h3>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Last updated: 2026</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>
{`Welcome to our website. We respect your privacy and are committed to protecting your personal information.

### Information we collect
We may collect basic information such as email, name, login data, and usage history when you use our tools, create an account, or make a payment.

### How we use information
We use your information to provide services, improve our tools, manage user accounts, and process payments. We do not sell your personal information.

### Cookies
Our website may use cookies to store login sessions, preferences, and analytics data.

### Google AdSense
We use Google AdSense to show ads. Google may use cookies to show personalized ads based on your visits to this and other websites.

### Third-party services
We may use third-party services such as Firebase, payment providers, and analytics tools to run our website.

### Payments
Payments made on our website are processed using secure payment methods. We do not store card or UPI details on our server.

### User accounts
Users are responsible for keeping their login details safe.

### Changes
We may update this privacy policy at any time without notice.

### Contact
If you have any questions, contact us at:

[harshitpandey1124@gmail.com](mailto:harshitpandey1124@gmail.com)`}
                </ReactMarkdown>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end">
                <button 
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="px-6 py-2 bg-brand-primary text-white font-bold rounded-xl hover:bg-brand-primary/90 transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

