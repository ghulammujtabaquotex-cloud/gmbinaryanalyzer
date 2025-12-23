import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionTier = 'free' | 'vip';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  amount: number;
  proof_image_url: string;
  status: PaymentStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPayment, setPendingPayment] = useState<PaymentRequest | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setPendingPayment(null);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      } else {
        setSubscription(subData as Subscription | null);
      }

      // Fetch pending payment request
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        console.error('Error fetching pending payment:', paymentError);
      } else {
        setPendingPayment(paymentData as PaymentRequest | null);
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isVip = useCallback(() => {
    if (!subscription) return false;
    if (subscription.tier !== 'vip') return false;
    if (subscription.expires_at) {
      return new Date(subscription.expires_at) > new Date();
    }
    return true;
  }, [subscription]);

  const tier = subscription?.tier || 'free';
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;

  return {
    subscription,
    tier,
    isVip: isVip(),
    expiresAt,
    pendingPayment,
    isLoading,
    refetch: fetchSubscription,
  };
};
