/* AudioWorklet global scope. Resample the microphone to mono PCM16 at 16 kHz. */
class CallCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.position = 0;
    this.sum = 0;
    this.count = 0;
    this.index = 0;
    this.chunk = new Int16Array(1600);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.sum += sample;
      this.count++;
      this.position += 16000;
      if (this.position < sampleRate) continue;
      this.position -= sampleRate;
      const average = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0;
      this.count = 0;
      this.chunk[this.index++] = average * (average < 0 ? 32768 : 32767);
      if (this.index === this.chunk.length) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(1600);
        this.index = 0;
      }
    }
    return true;
  }
}

registerProcessor("momo-call-capture", CallCapture);
