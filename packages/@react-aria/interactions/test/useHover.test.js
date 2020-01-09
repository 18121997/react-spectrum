import {cleanup, fireEvent, render} from '@testing-library/react';
import React from 'react';
import {useHover} from '../';

function Example(props) {
  let {hoverProps} = useHover(props);
  return <div {...hoverProps}>test</div>;
}

function pointerEvent(type, opts) {
  let evt = new Event(type, {bubbles: true, cancelable: true});
  Object.assign(evt, opts);
  return evt;
}

describe('useHover', function () {
  afterEach(cleanup);

  describe('pointer events', function () {
    beforeEach(() => {
      global.PointerEvent = {};
    });

    afterEach(() => {
      delete global.PointerEvent;
    });

    it('should fire hover events based on pointer events', function () {
      let events = [];
      let addEvent = (e) => events.push(e);
      let res = render(
        <Example
          onHoverStart={addEvent}
          onHoverEnd={addEvent}
          onHover={addEvent} />
      );

      let el = res.getByText('test');
      fireEvent.pointerEnter(el);
      fireEvent.pointerLeave(el);

      console.log('events array from pointer ->', events) // still empty, maybe you need to set something defined to get past the if
                                                                // check you have in useHover hook itself

      /*
      expect(events).toEqual([
        {
          type: 'hoverstart',
          target: el,
          pointerType: 'mouse',
        },
        {
          type: 'hover',
          target: el,
          pointerType: 'mouse',
        },
        {
          type: 'hoverend',
          target: el,
          pointerType: 'mouse',
        }
      ]);
      */

    });

    it('should fire hover change events when moving pointer outside target', function () {

    });
  });

  describe('mouse events', function () {
    it('should fire hover events based on mouse events', function () {
      let events = [];
      let addEvent = (e) => events.push(e);
      let res = render(
        <Example
          onHoverStart={addEvent}
          onHoverEnd={addEvent}
          onHover={addEvent} />
      );

      let el = res.getByText('test');
      fireEvent.mouseEnter(el);
      fireEvent.mouseLeave(el);

      expect(events).toEqual([
        {
          type: 'hoverstart',
          target: el,
          pointerType: 'mouse',
        },
        {
          type: 'hover',
          target: el,
          pointerType: 'mouse',
        },
        {
          type: 'hoverend',
          target: el,
          pointerType: 'mouse',
        }
      ]);
    });
  });

  describe('touch events', function () {
    it('should not fire hover events based on touch events', function () {

    });

    it('should not fire hover change events when moving touch outside target', function () {

    });
  });

});
