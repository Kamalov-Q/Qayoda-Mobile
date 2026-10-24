import type { Socket } from "socket.io-client";
import { namespaceSocket } from "./socket";

/**
 * The public `/videos` namespace: a reel's counters while people are looking
 * at it. No session — everything it carries is already printed on the screen
 * that receives it, and most of the people watching a reel are signed out.
 *
 * Unlike the listings socket, exactly one reel is watched at a time: the
 * pager has three pages mounted but only one is playing, and the server
 * leaves the previous room on every `video:watch` for the same reason.
 */
const videos = namespaceSocket("/videos", { auth: false });

export const getVideosSocket = () => videos.get();
export const disconnectVideosSocket = () => videos.disconnect();

/** What the server pushes. Only what moved is sent; patch what you are given. */
export interface VideoStats {
  videoId: string;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
}

/** The reel currently being watched, re-sent after a reconnect. */
let current: string | null = null;
let rejoinBound: Socket | null = null;

function bindRejoin(socket: Socket) {
  if (rejoinBound === socket) return;
  rejoinBound = socket;

  // A fresh socket starts in no rooms at all, and a reel can be on screen
  // for minutes — long enough to outlive a tunnel hiccup.
  socket.on("connect", () => {
    if (current) socket.emit("video:watch", { videoId: current });
  });
}

/** Watch one reel. Returns the way out. */
export function watchVideo(videoId: string): () => void {
  const socket = getVideosSocket();
  bindRejoin(socket);

  current = videoId;
  socket.emit("video:watch", { videoId });

  return () => {
    if (current !== videoId) return; // a newer page already took over
    current = null;
    socket.emit("video:unwatch", { videoId });
  };
}

/** Subscribe to the pushes. Returns the way out. */
export function onVideoStats(handler: (stats: VideoStats) => void): () => void {
  const socket = getVideosSocket();
  socket.on("video:stats", handler);
  return () => {
    socket.off("video:stats", handler);
  };
}
