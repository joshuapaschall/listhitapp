import { Button } from "@/components/ui/button";
import { Pause, Play, Download } from "lucide-react";

interface RecordingPlayerProps {
  telnyxRecordingId?: string | null;
  recordingUrl?: string | null;
  callSid?: string | null;
  status?: string | null;
  playingId: string | null;
  setPlayingId: (value: string | null) => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

export default function RecordingPlayer(props: RecordingPlayerProps) {
  const { telnyxRecordingId, recordingUrl, callSid, status, playingId, setPlayingId, audioRef } = props;
  // Show controls only when a durable recording exists.
  if (!recordingUrl && !telnyxRecordingId) return null;

  // Both play and download serve the Supabase copy, keyed by call_sid.
  const id = callSid ?? telnyxRecordingId ?? recordingUrl ?? null;
  if (!id) return null;

  const isPlaying = playingId === id;

  const onToggle = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (isPlaying) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`/api/recordings/${id}/stream`);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    await audio.play();
    setPlayingId(id);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onToggle} aria-label={isPlaying ? "Pause recording" : "Play recording"}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label="Download recording">
        <a href={`/api/recordings/${id}/download`} download>
          <Download className="h-4 w-4" />
        </a>
      </Button>
      <span className="text-xs text-muted-foreground">{status === "voicemail" ? "Voicemail" : "Recording"}</span>
    </div>
  );
}
