/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {Collection, Node} from '@react-stately/collections';
import {CollectionBase, SingleSelection} from '@react-types/shared';
import {Key, useMemo} from 'react';
import {SelectState, useSelectState} from '@react-stately/select';
import {useControlledState} from '@react-stately/utils';


export interface ComboBoxState<T> extends SelectState<T> {
  value: string,
  setValue: (value: string) => void
}

interface ComboBoxProps<T> extends CollectionBase<T>, SingleSelection {
  isOpen?: boolean,
  defaultOpen?: boolean,
  onOpenChange?: (isOpen: boolean) => void,
  inputValue?: string,
  defaultInputValue?: string,
  onInputChange?: (value: string) => void,
  onFilter?: (value: string) => void,
  allowsCustomValue?: boolean,
  onCustomValue?: (value: string) => void,
  completionMode?: 'suggest' | 'complete',
  menuTrigger?: 'focus' | 'input' | 'manual'
}

function* filter<T>(nodes: Iterable<Node<T>>, filterFn: (node: Node<T>) => boolean) {
  for (let node of nodes) {
    if (filterFn(node)) {
      yield node;
    }
  }
}

class FilteredCollection<T> implements Collection<Node<T>> {
  private keyMap: Map<Key, Node<T>> = new Map();
  private iterable: Iterable<Node<T>>;
  private firstKey: Key;
  private lastKey: Key;
  private filterFn: (node: Node<T>) => boolean;

  constructor(nodes: Iterable<Node<T>>, filterFn: (node: Node<T>) => boolean) {
    this.filterFn = filterFn;
    this.iterable = nodes;

    let visit = (node: Node<T>) => {
      this.keyMap.set(node.key, node);

      if (node.childNodes && (node.type === 'section' || node.isExpanded)) {
        for (let child of node.childNodes) {
          visit(child);
        }
      }
    };

    for (let node of this) {
      visit(node);
    }

    let last: Node<T>;
    let index = 0;
    for (let [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key;
        node.prevKey = last.key;
      } else {
        this.firstKey = key;
      }

      if (node.type === 'item') {
        node.index = index++;
      }

      last = node;
    }

    this.lastKey = last ? last.key : ''; // what to do in empty collection??
  }

  *[Symbol.iterator]() {
    yield* filter(this.iterable, this.filterFn);
  }

  get size() {
    return this.keyMap.size;
  }

  getKeys() {
    return this.keyMap.keys();
  }

  getKeyBefore(key: Key) {
    let node = this.keyMap.get(key);
    return node ? node.prevKey : null;
  }

  getKeyAfter(key: Key) {
    let node = this.keyMap.get(key);
    return node ? node.nextKey : null;
  }

  getFirstKey() {
    return this.firstKey;
  }

  getLastKey() {
    return this.lastKey;
  }

  getItem(key: Key) {
    return this.keyMap.get(key);
  }
}

export function useComboBoxState<T>(props: ComboBoxProps<T>): ComboBoxState<T> {
  let itemsControlled = !!props.onFilter;
  /*
  let menuControlled = props.isOpen !== undefined;
  let valueControlled = props.inputValue !== undefined;
  let selectedControlled = !!props.selectedKey;
   */

  let [value, setValue] = useControlledState(toString(props.inputValue), toString(props.defaultInputValue) || '', props.onInputChange);

  let selectState  = useSelectState(props);
  selectState.collection = useMemo(() => {
    if (itemsControlled || value === '') {
      return selectState.collection;
    }
    // should value be textValue?
    return new FilteredCollection(selectState.collection, (node) => node.textValue.startsWith(value));
  }, [selectState.collection, value, itemsControlled]);

  let open = function () {
    if (selectState.collection.size > 0) {
      selectState.open();
    }
    if (props.onFilter) {
      props.onFilter(undefined); // what is the value??
    }
  };
  let setOpen = function (value) {
    if (selectState.collection.size > 0 && value) {
      selectState.setOpen(value);
    }
    if (value && props.onFilter) {
      props.onFilter(undefined); // what is the value??
    }
  };
  let toggle = function () {
    if (selectState.collection.size > 0 && !selectState.isOpen) {
      selectState.toggle();
    }
    if (!selectState.isOpen && props.onFilter) {
      props.onFilter(undefined); // what is the value??
    }
  };

  // do i need a new selection manager?

  // For completionMode = complete
  // let [suggestionValue, setSuggestionValue] = useState('');


  return {
    ...selectState,
    open,
    setOpen,
    toggle,
    value,
    setValue
  };
}


function toString(val) {
  if (val == null) {
    return;
  }

  return val.toString();
}
