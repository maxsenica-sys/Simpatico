// Taps the local mic track, downsamples to 16 kHz mono, and posts ~100 ms PCM16 chunks
// with the chunk's level in dBFS (used for voice-activity gating on the main thread).
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = new Int16Array(1600);
    this.n = 0;
    this.acc = 0;
    this.accN = 0;
    this.t = 0;
    this.energy = 0;
    this.crossings = 0;
    this.prev = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      // Box-filter decimation: average the input samples that fall into each output sample.
      this.acc += ch[i];
      this.accN++;
      this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        let s = this.acc / this.accN;
        this.acc = 0;
        this.accN = 0;
        if (s > 1) s = 1;
        else if (s < -1) s = -1;
        this.energy += s * s;
        // Zero crossings: breathy / whispered sound crosses zero far more often than voiced sound.
        if ((s >= 0) !== (this.prev >= 0)) this.crossings++;
        this.prev = s;
        this.chunk[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.n === this.chunk.length) {
          const rms = Math.sqrt(this.energy / this.n);
          const db = rms > 0 ? 20 * Math.log10(rms) : -120;
          const out = this.chunk;
          const zcr = this.crossings / this.n;
          this.port.postMessage({ pcm: out.buffer, db, zcr }, [out.buffer]);
          this.chunk = new Int16Array(1600);
          this.n = 0;
          this.energy = 0;
          this.crossings = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
