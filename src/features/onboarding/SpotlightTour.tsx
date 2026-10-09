import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import { useReducedMotion } from "motion/react";
import { useWorkspace } from "../../data/queries";
import { useOnboarding } from "./context";
import { buildSpotlightSteps } from "./spotlight-steps";
import "driver.js/dist/driver.css";
import "./spotlight.css";

export function SpotlightTour() {
  const { status } = useOnboarding();
  return status === "touring" ? <ActiveSpotlight /> : null;
}
function ActiveSpotlight() {
  const { stepIndex, goToStep, dismiss, finish } = useOnboarding();
  const { data, isPending } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const steps = buildSpotlightSteps(data);
  const step = steps[stepIndex];
  const {
    route,
    selector,
    title,
    description,
    takeaway,
    chapter,
    interactive,
  } = step;
  const count = steps.length;

  useEffect(() => {
    if (isPending) return;
    if (`${location.pathname}${location.search}` !== route) {
      navigate(route, { replace: true });
      return;
    }
    let disposed = false;
    let observer: MutationObserver | undefined;
    let resize: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let restoreInteraction: (() => void) | undefined;
    const next = () =>
      stepIndex === count - 1 ? finish() : goToStep(stepIndex + 1);
    const instance = driver({
      animate: !reducedMotion,
      duration: 180,
      smoothScroll: false,
      overlayColor: "#142a32",
      overlayOpacity: 0.68,
      overlayClickBehavior: "none",
      stagePadding: 7,
      stageRadius: 12,
      popoverOffset: 16,
      popoverClass: "clarity-spotlight",
      allowKeyboardControl: false,
      showProgress: true,
      progressText: `${stepIndex + 1} / ${count}`,
      nextBtnText: stepIndex === count - 1 ? "Finish tour" : "Next",
      doneBtnText: "Finish tour",
      prevBtnText: "Back",
      closeBtnLabel: "Skip tour",
      onNextClick: next,
      onDoneClick: next,
      onPrevClick: () => goToStep(stepIndex - 1),
      onCloseClick: dismiss,
      onDestroyed: () => {
        if (!disposed) dismiss();
      },
      onPopoverRender: (popover) => {
        const label = document.createElement("p");
        label.className = "spotlight-chapter";
        label.textContent = chapter;
        popover.title.before(label);
        const note = document.createElement("p");
        note.className = "spotlight-takeaway";
        note.textContent = takeaway;
        popover.description.append(note);
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "spotlight-skip";
        skip.textContent = "Skip tour";
        skip.onclick = dismiss;
        popover.footer.after(skip);
        popover.wrapper.setAttribute("data-tour-step", step.id);
        popover.title.tabIndex = -1;
        // Let route focus management finish before announcing the new tour step.
        queueMicrotask(() => {
          if (!disposed && popover.wrapper.isConnected)
            popover.title.focus({ preventScroll: true });
        });
      },
    });
    // Only explicit media interaction is enabled. The walkthrough never activates a form or action.
    function show(element?: HTMLElement) {
      if (disposed) return;
      observer?.disconnect();
      clearTimeout(timer);
      if (element && !interactive) {
        const block = (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        element.addEventListener("keydown", block, true);
        restoreInteraction = () =>
          element.removeEventListener("keydown", block, true);
      }
      instance.setSteps(
        steps.map((_, index) => ({
          element: index === stepIndex ? element : undefined,
          disableActiveInteraction: !interactive,
          popover: {
            title,
            description: element
              ? description
              : `${description}<p class="spotlight-unavailable">This feature is not available in the current view yet. You can continue the tour or exit and check the page.</p>`,
            side: "bottom",
            align: "start",
            showButtons:
              stepIndex > 0 ? ["previous", "next", "close"] : ["next", "close"],
          },
        })),
      );
      if (element && window.innerWidth <= 600) {
        element.scrollIntoView({ block: "start", behavior: "instant" });
        window.scrollBy({ top: -24, behavior: "instant" });
      }
      const disclosureAttributes = [
        "aria-haspopup",
        "aria-expanded",
        "aria-controls",
      ];
      const originalAttributes = disclosureAttributes.map((name) =>
        element?.getAttribute(name),
      );
      instance.drive(stepIndex);
      // Informational panels are not disclosure controls. Preserve their original semantics.
      if (element)
        disclosureAttributes.forEach((name, index) => {
          const value = originalAttributes[index];
          if (value == null) element.removeAttribute(name);
          else element.setAttribute(name, value);
        });
      if (element) {
        resize = new ResizeObserver(() => instance.refresh());
        resize.observe(element);
        // Route entrance motion can move a target without changing its size.
        refreshTimer = setTimeout(() => instance.refresh(), 320);
      }
    }
    function findTarget() {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      ).find(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0,
      );
      if (element) {
        show(element);
        return true;
      }
      return false;
    }
    if (!findTarget()) {
      observer = new MutationObserver(findTarget);
      observer.observe(document.body, { childList: true, subtree: true });
      timer = setTimeout(() => show(), 6000);
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      disposed = true;
      observer?.disconnect();
      resize?.disconnect();
      clearTimeout(timer);
      clearTimeout(refreshTimer);
      restoreInteraction?.();
      window.removeEventListener("keydown", onKey);
      instance.destroy();
    };
    // Step content is static; primitive dependencies prevent polling from restarting a highlight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stepIndex,
    route,
    selector,
    title,
    description,
    takeaway,
    chapter,
    interactive,
    count,
    isPending,
    location.pathname,
    location.search,
    navigate,
    goToStep,
    dismiss,
    finish,
    reducedMotion,
  ]);

  return (
    <div className="spotlight-session" role="status">
      <span>
        Guided tour · {stepIndex + 1} of {count}
      </span>
      <button onClick={dismiss}>Exit tour</button>
    </div>
  );
}
