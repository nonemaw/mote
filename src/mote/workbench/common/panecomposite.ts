/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IComposite } from 'mote/workbench/common/composite';

export interface IPaneComposite extends IComposite {
	/**
	 * Returns the minimal width needed to avoid any content horizontal truncation
	 */
	getOptimalWidth(): number | undefined;
	//openView<T extends IView>(id: string, focus?: boolean): T | undefined;
	//getViewPaneContainer(): IViewPaneContainer | undefined;
	saveState(): void;
}

