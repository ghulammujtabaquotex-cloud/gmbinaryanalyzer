import { useState, useRef } from 'react';
import { ArrowLeft, Upload, ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_CONFIG } from '@/lib/paymentConfig';
import { toast } from 'sonner';
import { PaymentStatusTracker } from './PaymentStatusTracker';

interface PaymentProofUploadProps {
  onBack: () => void;
}

export const PaymentProofUpload = ({ onBack }: PaymentProofUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [email, setEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select an image');
      return;
    }

    if (!email || !validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `anonymous/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage using anon key (public upload)
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image. Please try again.');
        return;
      }

      // Create payment request record (anonymous)
      const { error: insertError } = await supabase
        .from('payment_requests')
        .insert({
          amount: PAYMENT_CONFIG.vipPrice,
          proof_image_url: fileName,
          email: email,
          status: 'pending',
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        toast.error('Failed to submit payment request. Please try again.');
        return;
      }

      setSubmittedEmail(email);
      setIsSubmitted(true);
      toast.success('Payment proof submitted successfully!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Show status tracker after submission
  if (isSubmitted && submittedEmail) {
    return <PaymentStatusTracker email={submittedEmail} onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <Card className="glass-card max-w-lg mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Upload Payment Proof</CardTitle>
            <CardDescription>
              Upload a screenshot of your completed Binance payment for ${PAYMENT_CONFIG.vipPrice} {PAYMENT_CONFIG.currency}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Your Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                We'll send your VIP login credentials to this email after approval
              </p>
            </div>

            {/* Upload Area */}
            <div
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-200
                ${previewUrl 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="Payment proof preview" 
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-medium mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-muted-foreground text-sm">
                    PNG, JPG up to 5MB
                  </p>
                </>
              )}
            </div>

            {/* Requirements */}
            <div className="bg-secondary/50 rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2 text-sm">
                Screenshot should include:
              </h4>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Payment amount ({PAYMENT_CONFIG.currency} {PAYMENT_CONFIG.vipPrice})</li>
                <li>• Transaction date and time</li>
                <li>• Payment status (Completed/Successful)</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              className="w-full"
              variant="analyze"
              disabled={!selectedFile || !email || isUploading}
              onClick={handleSubmit}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Submit Payment Proof
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};