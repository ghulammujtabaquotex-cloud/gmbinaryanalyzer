import { useState } from "react";
import { ChartUploader } from "@/components/ChartUploader";
import { AnalysisResults, type AnalysisData } from "@/components/AnalysisResults";
import { LoadingAnalysis } from "@/components/LoadingAnalysis";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const { toast } = useToast();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
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

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const imageBase64 = await fileToBase64(selectedImage);

      const { data, error } = await supabase.functions.invoke("analyze-chart", {
        body: { imageBase64 },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysisResult(data as AnalysisData);
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not analyze the chart. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ChartSense</h1>
              <p className="text-xs text-muted-foreground">Binary Trading Chart Analyzer</p>
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

          {/* Upload Section */}
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

          {/* Results Section */}
          {(isAnalyzing || analysisResult) && (
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
          {!analysisResult && !isAnalyzing && (
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
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-xs text-muted-foreground">
            ChartSense provides technical analysis only. No financial advice. No profit guarantee. Trade at your own risk.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
