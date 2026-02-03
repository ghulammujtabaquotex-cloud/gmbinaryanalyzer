// Simple Oscillator-based Audio Service to avoid external file dependencies
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const getContext = () => {
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }
    return audioCtx;
};

export const playSuccessAlert = () => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        // "Ding-Ding" effect
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.1); // A6

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);

        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch (e) {
        console.warn("Audio play failed", e);
    }
};

export const playWarningAlert = () => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        // Dissonant low frequencies
        osc1.frequency.setValueAtTime(150, ctx.currentTime);
        osc2.frequency.setValueAtTime(145, ctx.currentTime); // Slight detune for "buzz"

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.00001, ctx.currentTime + 2); // 2 seconds

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 2);
        osc2.stop(ctx.currentTime + 2);
    } catch (e) {
        console.warn("Audio play failed", e);
    }
};
