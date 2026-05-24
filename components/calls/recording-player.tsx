import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

interface RecordingPlayerProps {
  telnyxRecordingId?: string | null;
  recordingUrl?: string | null;
  status?: string | null;
  playingId: string | null;
  setPlayingId: (value: string | null) => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

export default function RecordingPlayer(props: RecordingPlayerProps) {
  const { telnyxRecordingId, recordingUrl, status, playingId, setPlayingId, audioRef } = props;
  const recordingId = telnyxRecordingId ?? recordingUrl ?? null;
  if (!recordingId) return null;

  const isPlaying = playingId === recordingId;

  const onToggle = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (isPlaying) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(`/api/recordings/${recordingId}/stream`);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    await audio.play();
    setPlayingId(recordingId);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onToggle} aria-label={isPlaying ? "Pause recording" : "Play recording"}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="text-xs text-muted-foreground">{status === "voicemail" ? "Voicemail" : "Recording"}</span>
    </div>
  );
}
