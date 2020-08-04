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

import {ComboBoxProps} from '@react-types/combobox';
import {Key, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Node} from '@react-types/shared';
import {SelectState} from '@react-stately/select';
import {useControlledState} from '@react-stately/utils';
import {useMenuTriggerState} from '@react-stately/menu';
import {useSingleSelectListState} from '@react-stately/list';

export interface ComboBoxState<T> extends SelectState<T> {
  inputValue: string,
  setInputValue: (value: string) => void,
  suggestedValue: string
}

interface ComboBoxStateProps<T> extends ComboBoxProps<T> {
  collator: Intl.Collator
}

function filter<T>(nodes: Iterable<Node<T>>, filterFn: (node: Node<T>) => boolean): Iterable<Node<T>> {
  let filteredNode = [];
  for (let node of nodes) {
    if (node.type === 'section' && node.hasChildNodes) {
      let copyOfNode = {...node};
      let copyOfChildNodes = copyOfNode.childNodes;
      let filtered = filter(copyOfChildNodes, filterFn);
      if ([...filtered].length > 0) {
        copyOfNode.childNodes = filtered;
        filteredNode.push(copyOfNode);
      }
    } else if (node.type !== 'section' && filterFn(node)) {
      filteredNode.push(node);
    }
  }
  return filteredNode;
}

export function useComboBoxState<T extends object>(props: ComboBoxStateProps<T>): ComboBoxState<T> {
  let {
    onFilter,
    collator,
    onSelectionChange,
    allowsCustomValue
  } = props;

  let [isFocused, setFocused] = useState(false);
  let itemsControlled = !!onFilter;

  let computeKeyFromValue = (value, collection) => {
    let key;
    for (let [itemKey, node] of collection.keyMap) {
      if (node.type !== 'section') {
        let itemText = node.textValue;
        if (itemText === value) {
          key = itemKey;
          break;
        }
      }
    }

    return key;
  };

  // Need this collection here so that an initial inputValue can be found via collection.getItem
  // This is really just a replacement for using CollectionBuilder
  let {collection} = useSingleSelectListState({
    ...props,
    // default to null if props.selectedKey isn't set to avoid useControlledState's uncontrolled to controlled warning
    selectedKey: props.selectedKey || null
  });

  if (props.selectedKey && props.inputValue) {
    let selectedItem = collection.getItem(props.selectedKey);
    let itemText = selectedItem ? selectedItem.textValue : '';
    if (itemText !== props.inputValue) {
      throw new Error('Mismatch between selected item and inputValue!');
    }
  }

  let onInputChange = (value) => {
    if (props.onInputChange) {
      props.onInputChange(value);
    }

    let newSelectedKey = computeKeyFromValue(value, collection);
    if (newSelectedKey !== selectedKey) {
      if (onSelectionChange) {
        onSelectionChange(newSelectedKey);
      }
    }
  };

  let initialSelectedKeyText = collection.getItem(props.selectedKey)?.textValue;
  let initialDefaultSelectedKeyText = collection.getItem(props.defaultSelectedKey)?.textValue;
  let [inputValue, setInputValue] = useControlledState(toString(props.inputValue), initialSelectedKeyText || toString(props.defaultInputValue) || initialDefaultSelectedKeyText || '', onInputChange);

  let selectedKey = props.selectedKey || computeKeyFromValue(inputValue, collection);

  let triggerState = useMenuTriggerState(props);

  // Fires on selection change (when user hits Enter, clicks list item, props.selectedKey is changed)
  let setSelectedKey = useCallback((key) => {
    let item = collection.getItem(key);
    let itemText = item ? item.textValue : '';
    itemText && setInputValue(itemText);

    // If itemText happens to be the same as the current input text but the keys don't match
    // setInputValue won't call onSelectionChange for us so we call it here manually
    if (itemText === inputValue && selectedKey !== key) {
      if (onSelectionChange) {
        onSelectionChange(key);
      }
    }

  }, [collection, setInputValue, inputValue, onSelectionChange, selectedKey]);

  // Update the selectedKey and inputValue when props.selectedKey updates
  let lastSelectedKeyProp = useRef('' as Key);
  useEffect(() => {
    // need this check since setSelectedKey changes a lot making this useEffect fire even when props.selectedKey hasn't changed
    if (lastSelectedKeyProp.current !== props.selectedKey) {
      setSelectedKey(props.selectedKey);
    }
    lastSelectedKeyProp.current = props.selectedKey;
  }, [props.selectedKey, setSelectedKey]);

  let lowercaseValue = inputValue.toLowerCase().replace(' ', '');

  let defaultFilterFn = useMemo(() => (node: Node<T>) => {
    let scan = 0;
    let lowercaseNode = node.textValue.toLowerCase().replace(' ', '');
    let sliceLen = lowercaseValue.length;
    let match = false;

    for (; scan + sliceLen <= lowercaseNode.length && !match; scan++) {
      let nodeSlice = lowercaseNode.slice(scan, scan + sliceLen);
      let compareVal = collator.compare(lowercaseValue, nodeSlice);
      if (compareVal === 0) {
        match = true;
      }
    }

    return match;
  }, [collator, lowercaseValue]);

  let lastValue = useRef('');
  useEffect(() => {
    if (onFilter && lastValue.current !== inputValue) {
      onFilter(inputValue);
    }

    lastValue.current = inputValue;
  }, [inputValue, onFilter]);

  let nodeFilter = useMemo(() => {
    if (itemsControlled || inputValue === '') {
      return null;
    }
    return (nodes) => filter(nodes, defaultFilterFn);
  }, [itemsControlled, inputValue, defaultFilterFn]);

  let {collection: filteredCollection, disabledKeys, selectionManager, selectedItem} = useSingleSelectListState(
    {
      ...props,
      // Fall back to null as the selectedKey to avoid useControlledState error of uncontrolled to controlled and viceversa
      selectedKey: selectedKey || null,
      onSelectionChange: (key: Key) => setSelectedKey(key),
      filter: nodeFilter
    }
  );

  // Prevent open operations from triggering if there is nothing to display
  let open = (focusStrategy?) => {
    if (filteredCollection.size > 0) {
      triggerState.open(focusStrategy);
    }
  };
  // TODO: need to adjust the below to work for sections, currently only works for section less comboboxes
  // Alternative is to change it so the filter applied to the collection because space sensitive (but only in completionMode: complete) so that
  // the first focused item is always gonna be a autocomplete match, meaning we don't need filteredTextValues anymore, just the first "if statement" but
  let filteredTextValues = useMemo(() => [...filteredCollection].map(item => item.textValue), [filteredCollection]);
  let suggestedValue = useMemo(() => {
    let match;

    if (inputValue.length > 0 && !allowsCustomValue) {
      // Should the suggestion be case sensitive?
      let sliceLen = inputValue.length;
      let focusedKey = selectionManager.focusedKey;

      if (focusedKey) {
        let focusedText = filteredCollection.getItem(focusedKey)?.textValue;
        let valueSlice = focusedText?.slice(0, sliceLen);
        if (valueSlice && collator.compare(inputValue, valueSlice) === 0) {
          match = focusedText;
        }
      }

      // If focusedKey doesn't exist or it doesn't match as a valid autocomplete for the current input text
      // go through the rest of the values to check if there are any other matches
      // e.g. input value = ItemO, menu values are "Item One" (focused cuz first in list) and "ItemOne" (this one is a match for autocomplete)
      if (!match) {
        for (let value of filteredTextValues) {
          if (value) {
            let valueSlice = value.slice(0, sliceLen);
            if (collator.compare(inputValue, valueSlice) === 0) {
              match = value;
              break;
            }
          }
        }
      }
    }
    return match;
  }, [collator, filteredTextValues, inputValue, selectionManager.focusedKey]);

  return {
    ...triggerState,
    open,
    selectionManager,
    selectedKey,
    setSelectedKey,
    disabledKeys,
    isFocused,
    setFocused,
    selectedItem,
    collection: filteredCollection,
    isOpen: triggerState.isOpen && isFocused && filteredCollection.size > 0,
    inputValue,
    setInputValue,
    suggestedValue
  };
}

function toString(val) {
  if (val == null) {
    return;
  }

  return val.toString();
}
