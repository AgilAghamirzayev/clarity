import { useEffect, useRef, useState } from "react";
import type { DemoRecording } from "../../data/demo-recordings";

export function RecordingPlayer({ recording }: { recording: DemoRecording }) {
  const player = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = player.current;
    if (!element) return;
    const url = URL.createObjectURL(recording.file);
    element.src = url;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [recording.file]);
  return (
    <>
      <audio
        ref={player}
        className="recording-player"
        controls
        preload="metadata"
        aria-label={`Recording: ${recording.file.name}`}
        onError={() => setFailed(true)}
      />
      {failed && (
        <p role="alert" className="field-error">
          This browser cannot play this recording. Check that the file contains
          audio and uses a supported codec.
        </p>
      )}
    </>
  );
}
