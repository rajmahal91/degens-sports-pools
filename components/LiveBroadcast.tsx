"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  isTrackReference,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  VideoConference,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import "@livekit/components-styles";
import { createClient } from "@/lib/supabase/client";

export type LiveDrawState = {
  prizeId: string;
  prizeTitle: string;
  week: number | null;
  entries: string[];
  eligibleCount: number;
  rotation: number;
  drawing: boolean;
  winner: string | null;
  drawId: string | null;
};

function LiveDrawSync({
  asHost,
  state,
  onState,
}: {
  asHost: boolean;
  state?: LiveDrawState;
  onState?: (state: LiveDrawState) => void;
}) {
  const room = useRoomContext();
  const latest = useRef(state);
  latest.current = state;
  const publish = async (value?: LiveDrawState) => {
    if (!value || room.state !== ConnectionState.Connected) return;
    await room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(value)),
      { reliable: true, topic: "degens-prize-draw" },
    );
  };
  useEffect(() => {
    if (asHost) void publish(state);
  }, [asHost, state]);
  useEffect(() => {
    if (!asHost) return;
    const replay = () => void publish(latest.current);
    room.on(RoomEvent.ParticipantConnected, replay);
    return () => {
      room.off(RoomEvent.ParticipantConnected, replay);
    };
  }, [asHost, room]);
  useEffect(() => {
    if (asHost || !onState) return;
    const receive = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== "degens-prize-draw") return;
      try {
        onState(JSON.parse(new TextDecoder().decode(payload)) as LiveDrawState);
      } catch {
        // Ignore malformed room data.
      }
    };
    room.on(RoomEvent.DataReceived, receive);
    return () => {
      room.off(RoomEvent.DataReceived, receive);
    };
  }, [asHost, onState, room]);
  return null;
}

function CommissionerMediaControls() {
  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    microphoneTrack,
    cameraTrack,
  } = useLocalParticipant();
  const room = useRoomContext();
  const connectionState = useConnectionState(),
    connected = connectionState === ConnectionState.Connected;
  const [micLevel, setMicLevel] = useState(0);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const isLive = isCameraEnabled || isMicrophoneEnabled || isScreenShareEnabled;
  // Build the preview directly from the publication returned by the local
  // participant hook. This avoids a track-enumeration race on mobile Safari
  // where the camera is published but the host preview remains blank.
  const localCamera = cameraTrack
    ? {
        participant: localParticipant,
        publication: cameraTrack,
        source: Track.Source.Camera,
      }
    : undefined;
  const meterFrame = useRef<number>(0),
    audioContext = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      cancelAnimationFrame(meterFrame.current);
      void audioContext.current?.close();
    },
    [],
  );
  function stopMeter() {
    cancelAnimationFrame(meterFrame.current);
    void audioContext.current?.close();
    audioContext.current = null;
    setMicLevel(0);
  }
  function startMeter(stream: MediaStream) {
    stopMeter();
    try {
      const context = new AudioContext();
      audioContext.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.frequencyBinCount);
      const read = () => {
        analyser.getByteFrequencyData(values);
        setMicLevel(values.reduce((a, b) => a + b, 0) / values.length);
        meterFrame.current = requestAnimationFrame(read);
      };
      read();
    } catch {
      // The level meter is optional; iOS may suspend Web Audio while the
      // microphone track itself remains live and audible to viewers.
      setMicLevel(0);
    }
  }
  useEffect(() => {
    const mediaTrack = microphoneTrack?.track?.mediaStreamTrack;
    if (!isMicrophoneEnabled || !mediaTrack) {
      stopMeter();
      return;
    }
    startMeter(new MediaStream([mediaTrack]));
    return stopMeter;
  }, [isMicrophoneEnabled, microphoneTrack]);
  async function toggle(kind: "camera" | "microphone" | "screen") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "camera") {
        if (isCameraEnabled) {
          await localParticipant.setCameraEnabled(false);
        } else {
          if (!navigator.mediaDevices?.getUserMedia)
            throw new Error("Camera access is not supported in this browser.");
          const publication = await localParticipant.setCameraEnabled(true, {
            facingMode: "user",
          });
          if (
            !publication?.track ||
            publication.track.mediaStreamTrack.readyState !== "live"
          )
            throw new Error("The camera could not be started.");
        }
      }
      if (kind === "microphone") {
        if (isMicrophoneEnabled) {
          await localParticipant.setMicrophoneEnabled(false);
          stopMeter();
        } else {
          if (!navigator.mediaDevices?.getUserMedia)
            throw new Error(
              "Microphone access is not supported in this browser.",
            );
          const publication = await localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          if (
            !publication?.track ||
            publication.track.mediaStreamTrack.readyState !== "live"
          )
            throw new Error("The microphone could not be started.");
        }
      }
      if (kind === "screen") {
        if (!isScreenShareEnabled && !navigator.mediaDevices?.getDisplayMedia)
          throw new Error("Screen sharing is not supported on this iPhone.");
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
      }
    } catch (e) {
      const detail =
        e instanceof Error ? `${e.name}: ${e.message}` : "Unknown device error";
      setError(
        `${detail}. Check the camera and microphone permissions beside the browser address.`,
      );
    } finally {
      setBusy("");
    }
  }
  async function toggleLive() {
    setBusy("live");
    setError("");
    try {
      if (isLive) {
        if (isCameraEnabled)
          await localParticipant.setCameraEnabled(false);
        if (isMicrophoneEnabled)
          await localParticipant.setMicrophoneEnabled(false);
        if (isScreenShareEnabled)
          await localParticipant.setScreenShareEnabled(false);
        stopMeter();
      } else {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera and microphone access are not supported.");
        const cameraPublication = await localParticipant.setCameraEnabled(true, {
          facingMode: "user",
        });
        if (
          !cameraPublication?.track ||
          cameraPublication.track.mediaStreamTrack.readyState !== "live"
        )
          throw new Error("The camera could not be started.");
        let microphonePublication;
        try {
          microphonePublication = await localParticipant.setMicrophoneEnabled(
            true,
            {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          );
        } catch (microphoneError) {
          await localParticipant.setCameraEnabled(false);
          throw microphoneError;
        }
        if (
          !microphonePublication?.track ||
          microphonePublication.track.mediaStreamTrack.readyState !== "live"
        ) {
          await localParticipant.setCameraEnabled(false);
          throw new Error("The microphone could not be started.");
        }
        console.info("[live/media] host media enabled", {
          cameraTrackSid: cameraPublication.trackSid,
          microphoneTrackSid: microphonePublication.trackSid,
        });
      }
    } catch (e) {
      const detail =
        e instanceof Error ? `${e.name}: ${e.message}` : "Unknown device error";
      setError(
        `${detail}. Check the camera and microphone permissions beside the browser address.`,
      );
    } finally {
      setBusy("");
    }
  }
  function leave() {
    void localParticipant.setCameraEnabled(false);
    void localParticipant.setMicrophoneEnabled(false);
    room.disconnect();
  }
  return (
    <>
      {isCameraEnabled && localCamera && (
        <div
          className={`commissionerCameraPreview ${isScreenShareEnabled ? "pictureInPicture" : ""}`}
        >
          <VideoTrack
            key={localCamera.publication.trackSid}
            trackRef={localCamera}
            autoPlay
            playsInline
            muted
          />
          <b>YOU</b>
        </div>
      )}
      <div className={`roomConnection ${connected ? "connected" : ""}`}>
        {connected
          ? "● LIVE ROOM CONNECTED"
          : `● ${connectionState.toUpperCase()}…`}
      </div>
      <div className="commissionerMediaControls">
        <button
          type="button"
          className={`broadcastToggle ${isLive ? "live" : ""}`}
          disabled={!!busy || !connected}
          onClick={toggleLive}
        >
          <strong>{isLive ? "■" : "●"}</strong>
          <small>
            {busy === "live"
              ? "Please wait…"
              : isLive
                ? "End Live"
                : "Start Live"}
          </small>
        </button>
        <button
          type="button"
          className={isMicrophoneEnabled ? "on" : ""}
          disabled={!!busy || !connected}
          onClick={() => toggle("microphone")}
        >
          <strong>{isMicrophoneEnabled ? "🎙" : "🔇"}</strong>
          <small>{isMicrophoneEnabled ? "Mute" : "Unmute"}</small>
          {isMicrophoneEnabled && (
            <i
              className="micMeter"
              style={{ width: `${Math.max(8, Math.min(100, micLevel))}%` }}
            />
          )}
        </button>
        <button
          type="button"
          className={isCameraEnabled ? "on" : ""}
          disabled={!!busy || !connected}
          onClick={() => toggle("camera")}
        >
          <strong>{isCameraEnabled ? "📹" : "▣"}</strong>
          <small>{isCameraEnabled ? "Stop Video" : "Start Video"}</small>
        </button>
        <button
          type="button"
          className={isScreenShareEnabled ? "on shareOn" : ""}
          disabled={!!busy || !connected}
          onClick={() => toggle("screen")}
        >
          <strong>▤</strong>
          <small>{isScreenShareEnabled ? "Stop Share" : "Share"}</small>
        </button>
        <button type="button" className="leaveRoom" onClick={leave}>
          <strong>↪</strong>
          <small>Leave</small>
        </button>
      </div>
      {error && <div className="mediaNotice">{error}</div>}
    </>
  );
}

function MeetingStatus({
  asHost,
  meetingCode,
}: {
  asHost: boolean;
  meetingCode: string;
}) {
  const viewers = useRemoteParticipants();
  return (
    <div className="meetingStatus">
      <span className={asHost ? "hostBadge" : "viewerBadge"}>
        {asHost ? "HOST" : "VIEWER"}
      </span>
      <span>Meeting {meetingCode}</span>
      <b>
        <i />{" "}
        {asHost
          ? `${viewers.length} watching`
          : `${viewers.length + 1} in meeting`}
      </b>
    </div>
  );
}

function ViewerStage() {
  const room = useRoomContext();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState("");
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
    .filter(isTrackReference)
    .filter((track) => !track.participant.isLocal);
  const primary =
    tracks.find((track) => track.source === Track.Source.ScreenShare) ||
    tracks.find((track) => track.source === Track.Source.Camera);
  async function enableSound() {
    setSoundError("");
    try {
      await room.startAudio();
      setSoundEnabled(true);
    } catch (error) {
      setSoundError(
        error instanceof Error ? error.message : "Could not enable audio",
      );
    }
  }
  return (
    <div className="viewerStage">
      {primary ? (
        <VideoTrack
          key={primary.publication.trackSid}
          trackRef={primary}
          playsInline
        />
      ) : (
        <div className="viewerWaiting">
          <i />
          <strong>Waiting for the commissioner</strong>
          <span>The live camera or shared screen will appear here.</span>
        </div>
      )}
      <RoomAudioRenderer />
      <button
        type="button"
        className={`viewerSoundButton ${soundEnabled ? "enabled" : ""}`}
        onClick={enableSound}
      >
        {soundEnabled ? "🔊 Sound On" : "🔇 Turn On Sound"}
      </button>
      {soundError && <div className="viewerSoundError">{soundError}</div>}
    </div>
  );
}

type ChatMessage = {
  kind: "message";
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
  isHost: boolean;
};

type ChatEvent = ChatMessage | { kind: "delete"; id: string } | { kind: "clear" };

function LiveChat({ asHost }: { asHost: boolean }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSentAt = useRef(0);
  messagesRef.current = messages;

  async function publish(event: ChatEvent) {
    await room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(event)),
      { reliable: true, topic: "degens-live-chat" },
    );
  }

  useEffect(() => {
    const receive = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== "degens-live-chat") return;
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as ChatEvent;
        if (event.kind === "clear") {
          setMessages([]);
        } else if (event.kind === "delete") {
          setMessages((current) => current.filter((message) => message.id !== event.id));
        } else if (event.kind === "message" && event.text && event.id) {
          setMessages((current) =>
            current.some((message) => message.id === event.id)
              ? current
              : [...current, event].slice(-150),
          );
        }
      } catch {
        // Ignore malformed room data.
      }
    };
    room.on(RoomEvent.DataReceived, receive);
    return () => {
      room.off(RoomEvent.DataReceived, receive);
    };
  }, [room]);

  useEffect(() => {
    if (!asHost) return;
    const replay = () => {
      messagesRef.current.forEach((message) => void publish(message));
    };
    room.on(RoomEvent.ParticipantConnected, replay);
    return () => {
      room.off(RoomEvent.ParticipantConnected, replay);
    };
  }, [asHost, room]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim().replace(/\s+/g, " ").slice(0, 280);
    if (!text || sending || room.state !== ConnectionState.Connected) return;
    const now = Date.now();
    if (now - lastSentAt.current < 700) {
      setNotice("Please wait a moment before sending again.");
      return;
    }
    const message: ChatMessage = {
      kind: "message",
      id: crypto.randomUUID(),
      senderId: localParticipant.identity,
      senderName: localParticipant.name || (asHost ? "Commissioner" : "Player"),
      text,
      sentAt: now,
      isHost: asHost,
    };
    setSending(true);
    setNotice("");
    try {
      await publish(message);
      lastSentAt.current = now;
      setMessages((current) => [...current, message].slice(-150));
      setDraft("");
    } catch {
      setNotice("Message could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(id: string) {
    if (!asHost) return;
    setMessages((current) => current.filter((message) => message.id !== id));
    await publish({ kind: "delete", id }).catch(() => setNotice("Could not remove message."));
  }

  async function clearChat() {
    if (!asHost || !messages.length) return;
    setMessages([]);
    await publish({ kind: "clear" }).catch(() => setNotice("Could not clear chat."));
  }

  return (
    <aside className="liveChatPanel" aria-label="Live meeting chat">
      <div className="liveChatHeader">
        <div>
          <strong>Meeting chat</strong>
          <span>{messages.length ? `${messages.length} messages` : "Live discussion"}</span>
        </div>
        {asHost && messages.length > 0 && (
          <button type="button" onClick={clearChat}>Clear</button>
        )}
      </div>
      <div className="liveChatMessages" ref={listRef} aria-live="polite">
        {!messages.length && (
          <div className="liveChatEmpty">
            <i>✦</i>
            <strong>No messages yet</strong>
            <span>Say hello or react to the live prize draw.</span>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.senderId === localParticipant.identity;
          return (
            <article className={`liveChatMessage ${mine ? "mine" : ""}`} key={message.id}>
              <div>
                <b>{mine ? "You" : message.senderName}</b>
                {message.isHost && <em>HOST</em>}
                <time>{new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                {asHost && !mine && (
                  <button type="button" aria-label={`Remove message from ${message.senderName}`} onClick={() => removeMessage(message.id)}>×</button>
                )}
              </div>
              <p>{message.text}</p>
            </article>
          );
        })}
      </div>
      <form className="liveChatComposer" onSubmit={send}>
        <label htmlFor="live-chat-message">Message everyone</label>
        <div>
          <input
            id="live-chat-message"
            value={draft}
            maxLength={280}
            autoComplete="off"
            placeholder="Type a message…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">➤</button>
        </div>
        <small>{notice || `${draft.length}/280`}</small>
      </form>
    </aside>
  );
}

export default function LiveBroadcast({
  asHost,
  meetingCode,
  drawState,
  onDrawState,
}: {
  asHost: boolean;
  meetingCode: string;
  drawState?: LiveDrawState;
  onDrawState?: (state: LiveDrawState) => void;
}) {
  const [cfg, setCfg] = useState<{
      token: string;
      url: string;
      role: "host" | "viewer";
    } | null>(null),
    [error, setError] = useState(""),
    [roomError, setRoomError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setCfg(null);
        setError("");
        setRoomError("");
        const { data } = await createClient().auth.getSession();
        const headers = new Headers({ "content-type": "application/json" });
        if (data.session?.access_token)
          headers.set("authorization", `Bearer ${data.session.access_token}`);
        const r = await fetch("/api/livekit/token", {
          method: "POST",
          headers,
          body: JSON.stringify({ roomName: `degens-${meetingCode}`, asHost }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Live broadcast unavailable");
        if (asHost && j.role !== "host")
          throw new Error(
            "Commissioner broadcast permissions were not granted. Please refresh and try again.",
          );
        if (active) setCfg(j);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Live broadcast unavailable",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [asHost, attempt, meetingCode]);
  if (error)
    return (
      <div className="videoPlaceholder">
        <span>LIVE VIDEO</span>
        <strong>Broadcast not connected</strong>
        <p>{error}</p>
      </div>
    );
  if (!cfg)
    return (
      <div className="videoPlaceholder">
        <strong>Connecting live room…</strong>
      </div>
    );
  return (
    <div className="liveBroadcastShell">
      <div className="livekitWrap" data-lk-theme="default">
        <LiveKitRoom
          key={cfg.token}
          token={cfg.token}
          serverUrl={cfg.url}
          connect
          video={false}
          audio={false}
          onConnected={() => setRoomError("")}
          onError={(e) => setRoomError(`${e.name}: ${e.message}`)}
          onDisconnected={(reason) =>
            setRoomError(
              `Live room disconnected${reason ? `: ${String(reason)}` : ""}`,
            )
          }
        >
          <div className="liveRoomGrid">
            <div className="liveVideoPane">
              <MeetingStatus asHost={asHost} meetingCode={meetingCode} />
              <LiveDrawSync
                asHost={asHost}
                state={drawState}
                onState={onDrawState}
              />
              {cfg.role === "host" ? <VideoConference /> : <ViewerStage />}
              {cfg.role === "host" && <CommissionerMediaControls />}
            </div>
            <LiveChat asHost={cfg.role === "host"} />
          </div>
        </LiveKitRoom>
      </div>
      {roomError && (
        <div className="roomConnectionError">
          <div>
            <b>Live room disconnected</b>
            <span>{roomError}</span>
          </div>
          <button type="button" onClick={() => setAttempt((x) => x + 1)}>
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
