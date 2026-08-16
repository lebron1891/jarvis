"use client";

import {
  Eraser,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PenLine,
  PhoneOff,
  Send,
  Timer,
  Video,
  VideoOff,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PageLoader } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

interface ChatMessage {
  from: string;
  text: string;
  at: number;
}

function SessionRoomInner() {
  const { roomId } = useParams<{ roomId: string }>();
  const bookingId = useSearchParams().get("b");
  const router = useRouter();
  const { user } = useAuth();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"chat" | "board" | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  // Session timer once connected.
  useEffect(() => {
    if (!connected) return;
    startRef.current = startRef.current ?? Date.now();
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [connected]);

  const attachChannel = useCallback((channel: RTCDataChannel) => {
    channelRef.current = channel;
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.kind === "chat") {
          setChat((prev) => [...prev, { from: msg.from, text: msg.text, at: Date.now() }]);
        }
      } catch {
        /* ignore malformed peer data */
      }
    };
  }, []);

  const createPeer = useCallback(
    (peerId: string, initiator: boolean) => {
      const socket = getSocket();
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      peerIdRef.current = peerId;

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit("rtc:signal", { to: peerId, roomId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setConnected(true);
        }
      };
      pc.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setConnected(false);
        }
      };

      if (initiator) {
        attachChannel(pc.createDataChannel("session"));
        pc.createOffer()
          .then(async (offer) => {
            await pc.setLocalDescription(offer);
            socket?.emit("rtc:signal", { to: peerId, roomId, data: { sdp: pc.localDescription } });
          })
          .catch(() => undefined);
      } else {
        pc.ondatachannel = (e) => attachChannel(e.channel);
      }
      return pc;
    },
    [roomId, attachChannel],
  );

  // Media + signaling setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        setMediaError("Camera or microphone unavailable — check browser permissions.");
      }
      socket.emit("rtc:join", roomId);
    })();

    const onPeerJoined = ({ peerId }: { peerId: string }) => {
      // We were here first — we initiate the offer.
      pcRef.current?.close();
      createPeer(peerId, true);
    };
    const onSignal = async ({ from, data }: { from: string; data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }) => {
      let pc = pcRef.current;
      if (!pc || peerIdRef.current !== from) {
        pc = createPeer(from, false);
      }
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            getSocket()?.emit("rtc:signal", { to: from, roomId, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch {
        /* stale signaling state */
      }
    };
    const onPeerLeft = () => {
      setConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      pcRef.current?.close();
      pcRef.current = null;
      peerIdRef.current = null;
    };

    socket.on("rtc:peer-joined", onPeerJoined);
    socket.on("rtc:signal", onSignal);
    socket.on("rtc:peer-left", onPeerLeft);

    return () => {
      cancelled = true;
      socket.emit("rtc:leave", roomId);
      socket.off("rtc:peer-joined", onPeerJoined);
      socket.off("rtc:signal", onSignal);
      socket.off("rtc:peer-left", onPeerLeft);
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, user, createPeer]);

  // Whiteboard socket sync
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const draw = (stroke: { x0: number; y0: number; x1: number; y1: number; color: string }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
      ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
      ctx.stroke();
    };
    const onDraw = (p: { stroke: { x0: number; y0: number; x1: number; y1: number; color: string } }) => draw(p.stroke);
    const onClear = () => {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on("whiteboard:draw", onDraw);
    socket.on("whiteboard:clear", onClear);
    return () => {
      socket.off("whiteboard:draw", onDraw);
      socket.off("whiteboard:clear", onClear);
    };
  }, []);

  function boardPointer(e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (kind === "down") {
      drawingRef.current = true;
      lastPointRef.current = { x, y };
      return;
    }
    if (kind === "up") {
      drawingRef.current = false;
      lastPointRef.current = null;
      return;
    }
    if (!drawingRef.current || !lastPointRef.current) return;
    const stroke = { x0: lastPointRef.current.x, y0: lastPointRef.current.y, x1: x, y1: y, color: "#6366f1" };
    lastPointRef.current = { x, y };
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
      ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
      ctx.stroke();
    }
    getSocket()?.emit("whiteboard:draw", { roomId, stroke });
  }

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  }

  async function toggleShare() {
    const pc = pcRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;
    if (sharing) {
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) await sender.replaceTrack(camTrack);
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      await sender.replaceTrack(track);
      track.onended = async () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        if (camTrack) await sender.replaceTrack(camTrack);
        setSharing(false);
      };
      setSharing(true);
    } catch {
      /* user cancelled the picker */
    }
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !user) return;
    setChat((prev) => [...prev, { from: user.name, text, at: Date.now() }]);
    channelRef.current?.send(JSON.stringify({ kind: "chat", from: user.name, text }));
    setChatInput("");
  }

  function hangUp() {
    router.push(bookingId ? "/bookings" : "/dashboard");
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Live session</h1>
          <p className="text-sm text-zinc-500">
            {connected ? "Connected — happy learning!" : "Waiting for your partner to join…"}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium tabular-nums dark:bg-zinc-800">
          <Timer className="h-4 w-4 text-brand-500" />
          {mmss}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Video stage */}
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-3xl bg-zinc-950">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
          {!connected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-800" />
              <p className="text-sm">{mediaError ?? "Share this page's booking with your partner — they can join from Bookings."}</p>
            </div>
          )}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-28 w-40 rounded-xl border border-white/20 object-cover shadow-lift sm:h-36 sm:w-52"
          />

          {/* Controls */}
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-2xl bg-zinc-900/80 px-3 py-2 backdrop-blur">
              <ControlButton onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton onClick={toggleCam} active={camOn} label={camOn ? "Camera off" : "Camera on"}>
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton onClick={toggleShare} active={!sharing} label={sharing ? "Stop sharing" : "Share screen"}>
                <MonitorUp className={cn("h-5 w-5", sharing && "text-emerald-400")} />
              </ControlButton>
              <ControlButton
                onClick={() => setPanel(panel === "chat" ? null : "chat")}
                active={panel !== "chat"}
                label="Chat"
              >
                <MessageSquare className={cn("h-5 w-5", panel === "chat" && "text-brand-400")} />
              </ControlButton>
              <ControlButton
                onClick={() => setPanel(panel === "board" ? null : "board")}
                active={panel !== "board"}
                label="Whiteboard"
              >
                <PenLine className={cn("h-5 w-5", panel === "board" && "text-brand-400")} />
              </ControlButton>
              <button
                onClick={hangUp}
                className="ml-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-500"
                aria-label="Leave session"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Side panel */}
        {panel && (
          <aside className="card flex w-80 shrink-0 flex-col overflow-hidden">
            {panel === "chat" ? (
              <>
                <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Session chat
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {chat.length === 0 && (
                    <p className="text-center text-xs text-zinc-400">
                      Messages here stay in the session (peer-to-peer).
                    </p>
                  )}
                  {chat.map((m, i) => (
                    <div key={i} className={cn("flex", m.from === user?.name ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                          m.from === user?.name ? "bg-brand-600 text-white" : "bg-zinc-100 dark:bg-zinc-800",
                        )}
                      >
                        {m.from !== user?.name && (
                          <p className="mb-0.5 text-[10px] font-semibold opacity-60">{m.from}</p>
                        )}
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChat} className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <input
                    className="input flex-1"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={connected ? "Type a message…" : "Waiting for peer…"}
                    disabled={!connected}
                  />
                  <button
                    type="submit"
                    disabled={!connected || !chatInput.trim()}
                    className="rounded-xl bg-brand-600 px-3 text-white transition hover:bg-brand-500 disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <span className="text-sm font-semibold">Whiteboard</span>
                  <button
                    onClick={() => {
                      const canvas = canvasRef.current;
                      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
                      getSocket()?.emit("whiteboard:clear", roomId);
                    }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                </header>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={800}
                  className="h-full w-full flex-1 cursor-crosshair touch-none bg-white dark:bg-zinc-100"
                  onPointerDown={(e) => boardPointer(e, "down")}
                  onPointerMove={(e) => boardPointer(e, "move")}
                  onPointerUp={(e) => boardPointer(e, "up")}
                  onPointerLeave={(e) => boardPointer(e, "up")}
                />
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl text-white transition",
        active ? "bg-white/10 hover:bg-white/20" : "bg-red-500/80 hover:bg-red-500",
      )}
    >
      {children}
    </button>
  );
}

export default function SessionRoomPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SessionRoomInner />
    </Suspense>
  );
}
