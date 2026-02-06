let audioContext: AudioContext | null = null;
let silenceSource: AudioBufferSourceNode | null = null;

export const initBackgroundMode = async () => {
  if (audioContext && audioContext.state === 'running') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    audioContext = new AudioContext();

    const buffer = audioContext.createBuffer(1, 44100, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < 44100; i++) {
      data[i] = Math.random() * 0.000001;
    }

    const playSilence = () => {
      if (!audioContext) return;
      silenceSource = audioContext.createBufferSource();
      silenceSource.buffer = buffer;
      silenceSource.loop = true;
      silenceSource.connect(audioContext.destination);
      silenceSource.start();
    };

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    playSilence();
    console.log("Background Mode: Active (Silent Audio Loop)");
  } catch (e) {
    console.warn("Background Mode Failed:", e);
  }
};

export const playSuccessAlert = () => {
  // Disabled
};

export const playWarningAlert = () => {
  // Disabled
};
