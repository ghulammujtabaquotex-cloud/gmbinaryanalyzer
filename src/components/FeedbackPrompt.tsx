import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeedbackPromptProps {
  signal: "CALL" | "PUT";
  pair: string;
  onSubmit: (result: "WIN" | "LOSS") => Promise<{ error: string | null }>;
}

export function FeedbackPrompt({ signal, pair, onSubmit }: FeedbackPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (result: "WIN" | "LOSS") => {
    setIsSubmitting(true);
    const { error } = await onSubmit(result);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Result Successfully submitted",
        description: "Now you can analyze a new chart.",
      });
    }
  };

  return (
    <div className="p-6 rounded-xl glass-card gradient-border text-center space-y-4 animate-fade-in">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Previous Analysis Result</p>
        <div className="flex items-center justify-center gap-2">
          <span className={`text-lg font-bold ${signal === "CALL" ? "text-success" : "text-destructive"}`}>
            {signal}
          </span>
          <span className="text-muted-foreground">on</span>
          <span className="font-mono text-primary">{pair}</span>
        </div>
      </div>

      <p className="text-sm text-foreground">
        Did this trade win or lose? Submit your result to continue analyzing.
      </p>

      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          className="flex-1 max-w-[140px] border-success text-success hover:bg-success hover:text-success-foreground"
          onClick={() => handleSubmit("WIN")}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Win
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="flex-1 max-w-[140px] border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => handleSubmit("LOSS")}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <XCircle className="w-4 h-4 mr-2" />
              Loss
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Analysis is locked until you submit a result.
      </p>
    </div>
  );
}