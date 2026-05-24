export interface EditableNote {
  id: string;
  trackId: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export interface EditableTrack {
  id: string;
  name: string;
  channel: number;
  instrument?: number;
  color?: string;
}

export interface EditableSong {
  id: string;
  title: string;
  ppq: number;
  tempoBpm: number;
  tracks: EditableTrack[];
  notes: EditableNote[];
}
