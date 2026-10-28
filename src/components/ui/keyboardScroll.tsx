// src/components/ui/keyboardScroll.tsx
//
// Keeping the field you are typing in above the keyboard.
//
// Screen already lifts its content with a KeyboardAvoidingView, and that is
// enough when the form is short. It is not enough for a form you scroll: the
// lift shrinks the viewport but nothing SCROLLS, so a field below the fold —
// the post form's description, every time — stays under the keyboard while
// you type into it. react-native-web and both native platforms behave the
// same way here, and RN has no built-in that fixes it on Android (iOS's
// automaticallyAdjustKeyboardInsets only covers half of it, and double-counts
// against the KeyboardAvoidingView already in place).
//
// So: Screen publishes its scroller, every field asks to be made visible when
// it takes focus, and the scroll happens ONLY when the field would actually
// be covered. A form that fits never moves.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type RefObject,
} from "react";
import {
  Dimensions,
  Keyboard,
  type ScrollViewInstance,
} from "react-native";

/**
 * What this needs from the thing it scrolls to, and nothing more.
 *
 * A View's instance type is ReactNativeElement under the new architecture
 * and was View itself under the old one. Naming either couples this file to
 * which architecture is on; naming the one method it calls does not.
 */
export interface Measurable {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void,
  ): void;
}

/**
 * The keyboard's height, tracked once for the whole app.
 *
 * Module scope rather than a hook: this is read inside a focus handler, which
 * is not a render, and a hook would re-render every field on every keyboard
 * event to deliver a number none of them draw.
 */
let keyboardHeight = 0;
Keyboard.addListener("keyboardDidShow", (e) => {
  keyboardHeight = e.endCoordinates.height;
});
Keyboard.addListener("keyboardDidHide", () => {
  keyboardHeight = 0;
});
// Switching from a text field to a number field swaps the keyboard for a
// shorter one WITHOUT hiding it, so didShow never fires again and the height
// above stays at the taller layout's. The frame event is the only one that
// reports that.
Keyboard.addListener("keyboardDidChangeFrame", (e) => {
  if (keyboardHeight !== 0) keyboardHeight = e.endCoordinates.height;
});

export interface ScrollHost {
  scroller: RefObject<ScrollViewInstance | null>;
  /** Live scroll offset. A ref, so onScroll costs no renders. */
  offset: RefObject<number>;
}

const ScrollHostContext = createContext<ScrollHost | null>(null);

export const ScrollHostProvider = ScrollHostContext.Provider;

/**
 * Whether the keyboard is up, as state, for layout that must react to it.
 *
 * Deliberately a boolean and not the height. Screen is mounted by forty
 * screens and every one of them re-renders its whole subtree when this
 * changes, so it must change as seldom as possible — and the one thing
 * Screen does with it is decide whether to add a fixed amount of padding.
 * Reporting the height instead re-rendered every mounted screen again on
 * every keyboard-type swap (text field to number pad), to deliver a number
 * nothing drew.
 *
 * The module-level height above is for focus handlers, which are not
 * renders and do need the real value.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Breathing room between the field and the top of the keyboard.
 *
 * Generous on purpose. Clearing the keyboard by a hairline is technically
 * "visible" and still reads as cramped — and on a multiline field it leaves
 * the line you are typing sitting on the keyboard's edge. This is roughly
 * one more line of text plus a margin.
 */
export const KEYBOARD_GAP = 56;

/**
 * Returns a focus handler that scrolls `target` clear of the keyboard.
 *
 * No-ops outside a scrolling Screen — a field in a modal sheet is handled by
 * that sheet's own KeyboardAvoidingView, and scrolling a screen behind it
 * would move the wrong thing.
 */
export function useKeyboardScroll(target: RefObject<Measurable | null>) {
  const host = useContext(ScrollHostContext);

  return useCallback(() => {
    if (!host) return;

    let measured = false;
    const measure = () => {
      if (measured) return;
      measured = true;
      const node = target.current;
      const scroller = host.scroller.current;
      if (!node || !scroller) return;

      node.measureInWindow((_x, y, _w, height) => {
        const windowHeight = Dimensions.get("window").height;
        const lowestVisible = windowHeight - keyboardHeight - KEYBOARD_GAP;
        const hidden = y + height - lowestVisible;
        // Already clear of it: a form that fits must never jump.
        if (hidden <= 0) return;
        scroller.scrollTo({
          y: Math.max(0, host.offset.current + hidden),
          animated: true,
        });
      });
    };

    // Keyboard already up — switching from one field to another. The layout
    // is settled; one frame is enough for any padding just applied.
    if (keyboardHeight > 0) {
      requestAnimationFrame(measure);
      return;
    }

    /**
     * Not up yet. WAIT FOR IT, rather than guessing how long it takes.
     *
     * This used to poll: three retries, 120ms apart, then measure regardless.
     * iOS animates the keyboard in over roughly 250ms and only fires
     * keyboardDidShow at the END of it, so the last attempt landed with
     * `keyboardHeight` still zero — which makes `lowestVisible` the bottom of
     * the window, every field "already visible", and the whole thing a no-op.
     * It worked when moving between fields (keyboard already up) and never
     * worked on the first tap, which is exactly the description field.
     *
     * The event knows when it is up. The timeout only cleans the listener up
     * if the keyboard never appears at all.
     */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      sub.remove();
      if (timer) clearTimeout(timer);
      requestAnimationFrame(measure);
    });
    timer = setTimeout(() => sub.remove(), 2000);
  }, [host, target]);
}
