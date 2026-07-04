// リプレイ台: document スタブ
// keirin_logic.js がDOM直読みする要素IDに、レースごとの入力値を注入する。

export function createDom() {
  const elements = new Map();

  function makeElement(id) {
    const listeners = {};
    const el = {
      id,
      value: '',
      checked: false,
      innerHTML: '',
      innerText: '',
      textContent: '',
      style: {},
      dataset: {},
      scrollTop: 0,
      scrollHeight: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
      removeEventListener() {},
      appendChild() {},
      removeChild() {},
      remove() {},
      insertAdjacentHTML() {},
      setAttribute() {},
      getAttribute() { return null; },
      focus() {},
      blur() {},
      click() {},
      closest() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    };
    return el;
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return makeElement(`__created_${tag}`); },
    addEventListener() {},
    removeEventListener() {},
    body: makeElement('__body'),
    documentElement: makeElement('__html'),
  };

  /** レース入力を要素へ注入する（value として設定） */
  function setInputs(values) {
    for (const [id, v] of Object.entries(values)) {
      document.getElementById(id).value = String(v);
    }
  }

  /** 出力要素の innerHTML を回収する */
  function getOutput(id) {
    return elements.has(id) ? elements.get(id).innerHTML : '';
  }

  function reset() { elements.clear(); }

  return { document, setInputs, getOutput, reset };
}
