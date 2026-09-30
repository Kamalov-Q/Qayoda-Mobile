import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  storiesApi,
  type CreateStoryInput,
  type StoryDetail,
  type StoryGroup,
} from "../api/stories.api";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

const TRAY_KEY = ["stories", "tray"] as const;
const storyKey = (id: string) => ["stories", "detail", id] as const;
const viewersKey = (id: string) => ["stories", "viewers", id] as const;

/**
 * The tray on Home.
 *
 * Short staleTime because stories are the one thing on this screen that is
 * actually about *now* — someone posts, and the ring should be there when you
 * next glance at the app rather than after a cold start.
 */
export function useStoryTray() {
  const query = useQuery({
    queryKey: TRAY_KEY,
    queryFn: storiesApi.tray,
    staleTime: 30_000,
  });

  return { ...query, groups: query.data?.groups ?? [] };
}

/**
 * One person's stories, for their profile. Asking for the archive is
 * harmless on somebody else's profile — the server simply ignores it.
 */
export function useUserStories(userId: string | undefined, isMe: boolean) {
  const query = useQuery({
    queryKey: ["stories", "by-user", userId, isMe] as const,
    queryFn: () => storiesApi.byUser(userId!, isMe),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return { ...query, items: query.data?.items ?? [] };
}

export function useStory(id: string | undefined) {
  return useQuery({
    queryKey: storyKey(id ?? ""),
    queryFn: () => storiesApi.get(id!),
    enabled: !!id,
  });
}

/** Who watched it — the poster's own list. */
export function useStoryViewers(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: viewersKey(id ?? ""),
    queryFn: () => storiesApi.viewers(id!),
    enabled: !!id && enabled,
  });
}

export function usePostStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStoryInput) => storiesApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TRAY_KEY });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => storiesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TRAY_KEY });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Marks a story seen, and paints the tray as if it already were.
 *
 * Optimistic on purpose: the ring around an avatar is the one thing a reader
 * checks before deciding whether to open it again, and a ring that stays
 * green for a round trip is a ring that lies.
 */
export function useMarkStorySeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => storiesApi.markSeen(id),
    onMutate: (id) => {
      queryClient.setQueryData<{ groups: StoryGroup[] }>(TRAY_KEY, (old) =>
        old
          ? {
              groups: old.groups.map((group) => {
                if (!group.stories.some((s) => s.id === id)) return group;
                const stories = group.stories.map((s) =>
                  s.id === id ? { ...s, seen: true } : s,
                );
                return {
                  ...group,
                  stories,
                  hasUnseen: stories.some((s) => !s.seen),
                };
              }),
            }
          : old,
      );
    },
    // No rollback and no toast: a view that did not register is not something
    // to interrupt a reader for, and the next tray fetch puts it right.
    onError: () => {},
  });
}

/** Set, change or take back a reaction. */
export function useReactToStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      storiesApi.react(id, emoji),
    onSuccess: (result, { id }) => {
      queryClient.setQueryData<StoryDetail>(storyKey(id), (old) =>
        old
          ? {
              ...old,
              myReaction: result.myReaction,
              reactionCount: result.reactionCount,
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: viewersKey(id) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
