/* eslint-disable code-no-unexternalized-strings */
import { CSSProperties } from "mote/base/browser/jsx";
import { setStyles } from "mote/base/browser/jsx/createElement";
import { ThemedStyles } from "mote/base/common/themes";
import { $, addDisposableListener } from "vs/base/browser/dom";
import { Disposable } from "vs/base/common/lifecycle";
import * as DOM from 'vs/base/browser/dom';
import { Transaction } from "mote/editor/common/core/transaction";
import BlockStore from "mote/platform/store/common/blockStore";
import { EditOperation } from "mote/editor/common/core/editOperation";

export class EmptyHolder extends Disposable {

	store!: BlockStore;
	private parent: HTMLElement;
	private container: HTMLElement;

	constructor(parent: HTMLElement) {
		super();
		this.parent = parent;
		this.container = $(".empty-holder");

		setStyles(this.container, this.getPlaceholderStyle());
		this.container.innerText = "Click or press Enter to continue with an empty page";

		this._register(addDisposableListener(this.container, DOM.EventType.CLICK, (e) => {
			Transaction.createAndCommit((transaction) => {
				EditOperation.createChild(this.store, transaction);
			}, this.store.userId);
		}));
	}

	public show() {
		this.parent.append(this.container);
	}

	public hidden() {
		if (this.container.parentElement) {
			this.parent.removeChild(this.container);
		}
	}

	getPlaceholderStyle = (): CSSProperties => {
		return {
			paddingTop: 5,
			paddingBottom: 24,
			color: ThemedStyles.lightTextColor.dark
		}
	}
}
