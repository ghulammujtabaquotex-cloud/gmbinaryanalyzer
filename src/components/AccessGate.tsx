import { Lock, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const WHATSAPP_NUMBER = "923313063104";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hi! I want to access GM BINARY PRO premium tools. Please guide me."
);

interface AccessGateProps {
  toolName?: string;
}

const AccessGate = ({ toolName = "this tool" }: AccessGateProps) => {
  const navigate = useNavigate();
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="glass-card max-w-md w-full border-amber-500/30">
        <CardContent className="p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Access Restricted
            </h2>
            <p className="text-muted-foreground">
              {toolName} is currently available only for{" "}
              <span className="text-amber-400 font-semibold">VIP members</span>.
              Contact us to get access.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => window.open(whatsappUrl, "_blank")}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Click Here to Contact
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="w-full text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessGate;
