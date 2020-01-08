import {AllHTMLAttributes, RefObject, useContext} from 'react';
import {chain} from '@react-aria/utils';
import {DOMProps} from '@react-types/shared';
import {TooltipState} from '@react-stately/tooltip';
import {useId} from '@react-aria/utils';
import {useOverlay} from '@react-aria/overlays';
import {HoverProps, useHover} from '@react-aria/interactions';

interface TooltipProps extends DOMProps {
  onClose?: () => void,
  role?: 'tooltip'
}

interface TriggerProps extends DOMProps, AllHTMLAttributes<HTMLElement> {
  ref: RefObject<HTMLElement | null>,
}

interface TooltipTriggerProps {
  tooltipProps: TooltipProps,
  triggerProps: TriggerProps,
  state: TooltipState
}

interface InteractionProps extends DOMProps {
  onPressInteraction: () => void,
  onHoverInteraction: (value: boolean) => void,
}

interface TooltipTriggerAria {
  baseProps: AllHTMLAttributes<HTMLElement>,
  interactionProps: InteractionProps,
  hoverTriggerProps: AllHTMLAttributes<HTMLElement>,
  clickTriggerProps: AllHTMLAttributes<HTMLElement>
}

let visibleTooltips = []; // can used to track if a user has scrolled down the page thus 'hiding' an open tooltip
let tooltipStates = [];

export function useTooltipTrigger(props: TooltipTriggerProps): TooltipTriggerAria {
  let tooltipTriggerId = useId();

  let {
    triggerProps,
    state
  } = props;

  let onPressInteraction = () => {
    state.setOpen(!state.open);
  };

  let onHoverInteraction = (isHovering) => {
    state.setOpen(isHovering);
  };

  let onClose = () => {
    state.setOpen(false);
  };

  let {overlayProps} = useOverlay({
    ref: triggerProps.ref,
    onClose: onClose,
    isOpen: state.open
  });

  let onKeyDownTrigger = (e) => {
    if (triggerProps.ref && triggerProps.ref.current) {
      // dismiss tooltip on esc key press
      if (e.key === 'Escape' || e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        state.setOpen(false);
      }
    }
  };

  let enter = () => {
    let tooltipBucketItem = triggerProps.ref.current.id;
    visibleTooltips.push(tooltipBucketItem);
    tooltipStates.forEach(tooltip => tooltip.setOpen(false));
  };

  let exit = (e) => {
    console.log('exit function called')
    let hoveringOverTooltip = false;
    const related = e.relatedTarget || e.nativeEvent.toElement;
    const parent = related.parentNode;
    if (parent.getAttribute('role') === 'tooltip') {
      hoveringOverTooltip = true;
    }
    if (visibleTooltips.length > 0 && hoveringOverTooltip === false) {
      console.log('exit function closing the tooltip')
      state.setOpen(false); // ... this is called before onMouseEnter & delayedHide
    }
    visibleTooltips.pop();
  };

  let enterClick = () => {
    let tooltipBucketItem = triggerProps.ref.current.id;
    visibleTooltips.push(tooltipBucketItem);
    tooltipStates.push(state);
    if (visibleTooltips.length > 1) {
      visibleTooltips.shift();
    }
  };

  return {
    baseProps: {
      ...overlayProps,
      id: tooltipTriggerId,
      role: 'button',
      onKeyDown: chain(triggerProps.onKeyDown, onKeyDownTrigger)
    },
    interactionProps: {
      onPressInteraction,
      onHoverInteraction
    },
    hoverTriggerProps: {
      // ...hoverProps,
      onMouseEnter: enter,
      onMouseLeave: exit
    },
    clickTriggerProps: {
      onMouseDown: enterClick
    }
  };
}
