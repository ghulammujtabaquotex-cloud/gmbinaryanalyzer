import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChartUploader } from "@/components/ChartUploader";
import { AnalysisResults, type AnalysisData } from "@/components/AnalysisResults";
import { LoadingAnalysis } from "@/components/LoadingAnalysis";
import { UsageWarning } from "@/components/UsageWarning";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Zap, LogOut, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeAnalysisData } from "@/lib/validateAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { usePendingFeedback } from "@/hooks/usePendingFeedback";

const Index = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { remaining, dailyLimit, incrementUsage, canAnalyze, isLoading: usageLoading } = useUsageTracking();
  const { pendingFeedback, hasPendingFeedback, createPendingFeedback, submitResult, isLoading: feedbackLoading } = usePendingFeedback();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        title: "No chart uploaded",
        description: "Please upload a chart screenshot first.",
        variant: "destructive",
      });
      return;
    }

    if (!canAnalyze) {
      toast({
        title: "Daily limit reached",
        description: "You've used all 300 analysis requests for today. Try again tomorrow!",
        variant: "destructive",
      });
      return;
    }

    // Check for pending feedback - lock analysis until result submitted
    if (hasPendingFeedback) {
      toast({
        title: "Result pending",
        description: "Please submit your previous trade result before analyzing a new chart.",
        variant: "destructive",
      });
      return;
    }

    // Prevent double-click
    if (isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      // Check and increment usage before making the request
      const { allowed, remaining: newRemaining } = await incrementUsage();
      
      if (!allowed) {
        toast({
          title: "Daily limit reached",
          description: "You've used all 300 analysis requests for today. Try again tomorrow!",
          variant: "destructive",
        });
        return;
      }

      const imageBase64 = await fileToBase64(selectedImage);

      const { data, error } = await supabase.functions.invoke("analyze-chart", {
        body: { imageBase64 },
      });

      clearTimeout(timeoutId);

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Validate and sanitize AI response data
      const sanitizedData = sanitizeAnalysisData(data);
      setAnalysisResult(sanitizedData);

      // If CALL or PUT signal, create pending feedback (locks analysis until feedback)
      if (sanitizedData.signal === "CALL" || sanitizedData.signal === "PUT") {
        await createPendingFeedback(sanitizedData.signal, sanitizedData.pair);
      }

      // Show remaining usage toast
      toast({
        title: "Analysis complete!",
        description: `You have ${newRemaining} analysis requests remaining today.`,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Log only in development
      if (import.meta.env.DEV) {
        console.error("Analysis error:", error);
      }
      
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' 
          ? "Analysis timed out. Please try again." 
          : error.message)
        : "Could not analyze the chart. Please try again.";
      
      toast({
        title: "Analysis failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading || usageLoading || feedbackLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">GM BINARY PRO</h1>
                <p className="text-xs text-muted-foreground">Binary Trading Chart Analyzer</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/results")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trophy className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Results</span>
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <Zap className="w-4 h-4" />
              1-Minute Timeframe Analysis
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              AI-Powered <span className="text-gradient">Chart Analysis</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Upload your trading chart screenshot and get instant price action analysis with support, resistance, and next candle bias.
            </p>
          </div>

          {/* Usage Warning */}
          <div className="flex justify-center">
            <UsageWarning remaining={remaining} dailyLimit={dailyLimit} />
          </div>

          {/* Pending Feedback Section - Shows when user needs to submit result */}
          {hasPendingFeedback && pendingFeedback && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <Activity className="w-4 h-4" />
                <span>Action Required: Submit Trade Result</span>
              </div>
              <FeedbackPrompt
                signal={pendingFeedback.signal as "CALL" | "PUT"}
                pair={pendingFeedback.pair}
                onSubmit={submitResult}
              />
            </section>
          )}

          {/* Upload Section - Hidden when pending feedback */}
          {!hasPendingFeedback && (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  <span>Step 1: Upload Chart Screenshot</span>
                </div>
                <ChartUploader onImageSelect={setSelectedImage} selectedImage={selectedImage} />
              </section>

              {/* Analyze Button */}
              <div className="flex justify-center">
                <Button
                  variant="analyze"
                  size="xl"
                  onClick={handleAnalyze}
                  disabled={!selectedImage || isAnalyzing}
                  className="w-full sm:w-auto"
                >
                  {isAnalyzing ? (
                    <>
                      <Activity className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Analyze Chart
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Results Section */}
          {(isAnalyzing || analysisResult) && !hasPendingFeedback && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="w-4 h-4" />
                <span>Analysis Results</span>
              </div>
              {isAnalyzing ? (
                <LoadingAnalysis />
              ) : analysisResult ? (
                <AnalysisResults data={analysisResult} />
              ) : null}
            </section>
          )}

          {/* Info Cards */}
          {!analysisResult && !isAnalyzing && !hasPendingFeedback && (
            <section className="grid md:grid-cols-3 gap-4 pt-8">
              {[
                {
                  title: "Price Action",
                  description: "Analyzes candlestick patterns like pin bars, engulfing, and rejection wicks",
                },
                {
                  title: "Key Levels",
                  description: "Identifies support and resistance zones from visible chart structure",
                },
                {
                  title: "Next Candle Bias",
                  description: "Provides CALL, PUT, or NEUTRAL signal based on price action context",
                },
              ].map((card, i) => (
                <div
                  key={card.title}
                  className="p-5 rounded-xl glass-card gradient-border opacity-0 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <h3 className="font-semibold text-foreground mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <p className="text-center text-xs text-muted-foreground">
            GM BINARY PRO provides technical analysis only. No financial advice. No profit guarantee. Trade at your own risk.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            For more bots & recovery join group:{" "}
            <a
              href="https://chat.whatsapp.com/LqDeKcUo89c3Hu5CWjaAM9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:underline transition-colors"
            >
              JOIN
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;