import { CSSProperties } from 'mote/base/browser/jsx/style';
import { Button } from 'mote/base/browser/ui/button/button';
import { IMenuLike, IMenuLikeOptions } from 'mote/base/browser/ui/menu/menu';
import { ThemedStyles } from 'mote/base/common/themes';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { ActionViewItem, BaseActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { IAction } from 'vs/base/common/actions';

interface ISubMenuData {
	parent: QuickMenu;
	//submenu?: Menu;
}

export const QuickMenuHeight = 32;

class QuickActionViewItem extends ActionViewItem {

	private btn!: Button | null;

	override render(container: HTMLElement) {
		super.render(container);
		container.style.height = '100%';
	}

	override createLabel() {
		if (this.element) {
			const child = document.createElement('span');
			child.innerText = this.action.label;

			this.btn = new Button(this.element, { style: this.getButtonStyle() });
			this.btn.setChildren(child);
			this.label = this.btn.element;
			if (this.action.class) {
				this.label.className = this.action.class;
			}
		}
	}

	getBorderRight = () => {
		return {
			marginRight: 1,
			boxShadow: `1px 0 0 ${ThemedStyles.regularDividerColor.dark}`
		};
	};

	getButtonStyle = (): CSSProperties => {
		return Object.assign({
			display: 'flex',
			alignItems: 'center',
			padding: '0 8px',
			whiteSpace: 'nowrap' as any,
			height: '100%'
		}, this.getBorderRight());
	};
}

export class QuickMenu extends ActionBar implements IMenuLike {
	constructor(container: HTMLElement, actions: ReadonlyArray<IAction>, options: IMenuLikeOptions = {}) {
		container.classList.add('monaco-menu-container');
		container.setAttribute('role', 'presentation');

		const menuElement = document.createElement('div');
		menuElement.classList.add('monaco-menu');
		menuElement.setAttribute('role', 'presentation');
		menuElement.style.height = `${QuickMenuHeight}px`;
		menuElement.style.minWidth = '0px';

		super(menuElement, {
			orientation: ActionsOrientation.HORIZONTAL,
			actionViewItemProvider: action => this.doGetActionViewItem(action, options, parentData),
			actionRunner: options.actionRunner
		});

		const parentData: ISubMenuData = {
			parent: this
		};

		/*
		this._register(addDisposableListener(this.domNode, EventType.MOUSE_OUT, e => {
			const relatedTarget = e.relatedTarget as HTMLElement;
			if (!isAncestor(relatedTarget, this.domNode)) {
				this.focusedItem = undefined;
				this.updateFocus();
				e.stopPropagation();
			}
		}));

		this._register(addDisposableListener(this.actionsList, EventType.MOUSE_OVER, e => {
			let target = e.target as HTMLElement;
			if (!target || !isAncestor(target, this.actionsList) || target === this.actionsList) {
				return;
			}

			while (target.parentElement !== this.actionsList && target.parentElement !== null) {
				target = target.parentElement;
			}

			if (target.classList.contains('action-item')) {
				const lastFocusedItem = this.focusedItem;
				this.setFocusedItem(target);

				if (lastFocusedItem !== this.focusedItem) {
					this.updateFocus();
				}
			}
		}));
		*/

		this.push(actions, { icon: true, label: true, isMenu: true });

		container.appendChild(menuElement);
	}

	private doGetActionViewItem(action: IAction, options: IMenuLikeOptions, parentData: ISubMenuData): BaseActionViewItem {
		return new QuickActionViewItem(options.context, action, options);
	}

	style() {

	}
}
