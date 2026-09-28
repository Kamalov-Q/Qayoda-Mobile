// A stub, so that "add" is a real route the tab bar can own.
//
// The bar's centre button intercepts its own press and pushes `/add`, which
// is a full-screen stack route — the post form wants the whole screen and no
// tab bar under it. This file only matters for a deep link that lands here
// directly, and sends it where the button would have.
import { Redirect } from "expo-router";

export default function AddTabRedirect() {
  return <Redirect href="/add" />;
}
