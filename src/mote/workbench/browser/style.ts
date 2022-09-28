/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Mote team. All rights reserved.
 *  Licensed under the GPLv3 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { foreground, regularTextColor } from 'mote/platform/theme/common/themeColors';
import { registerThemingParticipant } from 'mote/platform/theme/common/themeService';
import { isSafari } from 'vs/base/browser/browser';
import { isMacintosh, isWindows } from 'vs/base/common/platform';
import 'vs/css!./media/style';


registerThemingParticipant((theme, collector) => {

	// Foreground
	const windowForeground = theme.getColor(foreground);
	if (windowForeground) {
		collector.addRule(`.workbench { color: ${windowForeground}; }`);
	}

	const viewLineTextColor = theme.getColor(regularTextColor);
	if (viewLineTextColor) {
		collector.addRule(`.view-line { color: ${viewLineTextColor}; }`);
	}

	// We disable user select on the root element, however on Safari this seems
	// to prevent any text selection in the monaco editor. As a workaround we
	// allow to select text in monaco editor instances.
	if (isSafari) {
		collector.addRule(`
			body.web {
				touch-action: none;
			}
			.workbench .editor .view-lines {
				user-select: text;
				-webkit-user-select: text;
			}
		`);
	}
});

/**
 * The best font-family to be used in CSS based on the platform:
 * - Windows: Segoe preferred, fallback to sans-serif
 * - macOS: standard system font, fallback to sans-serif
 * - Linux: standard system font preferred, fallback to Ubuntu fonts
 *
 * Note: this currently does not adjust for different locales.
 */
export const DEFAULT_FONT_FAMILY = isWindows ? '"Segoe WPC", "Segoe UI", sans-serif' : isMacintosh ? '-apple-system, BlinkMacSystemFont, sans-serif' : 'system-ui, "Ubuntu", "Droid Sans", sans-serif';


