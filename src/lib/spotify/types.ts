export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface Track {
  uri: string;
  name: string;
  artists: string; // "Artiste A, Artiste B"
  albumName: string;
  albumArt: string | null;
  durationMs: number;
}

export interface PlaybackState {
  track: Track | null;
  isPlaying: boolean;
  progressMs: number;
  volumePercent: number;
}

export interface Device {
  id: string;
  name: string;
  type: string; // "Computer", "Smartphone"…
  is_active: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  image: string | null;
}
