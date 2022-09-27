import { foreground, regularTextColor } from 'mote/platform/theme/common/themeColors';
import { registerThemingParticipant } from 'mote/platform/theme/common/themeService';
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
});

