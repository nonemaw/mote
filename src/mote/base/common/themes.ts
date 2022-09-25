/* eslint-disable code-no-unexternalized-strings */
import * as Chroma from 'chroma-js';

const defaultLightWithAlpha = (alapha: number) => `rgba(55, 53, 47, ${alapha})`;
const defaultDarkWithAlpha = (alapha: number) => `rgba(255, 255, 255, ${alapha})`;
const darkenWithAlpha = (color: string | number | Chroma.Color, alapha: number) => Chroma(color).darken(alapha).css();
//const brightenWithAlpha = (color: string | number | Chroma.Color, alapha: number) => Chroma(color).brighten(alapha).css();

const redWithAlpha = (alapha: number) => `rgba(235, 87, 87, ${alapha})`;

export const blueWithAlpha = (alapha: number) => `rgba(46, 170, 220, ${alapha})`;

function m(e: number) {
	const t = (color: Chroma.Color, s: number) => e >= 0 && e < 360 ? color.set("hsl.s", s).set("hsl.h", e) : color.set("hsl.s", 0);
	return {
		black: t(Chroma.hsl(0, .01, .07), .16),
		darkgray: t(Chroma.hsl(0, .01, .2), .08),
		gray: t(Chroma.hsl(0, .01, .5), .06),
		lightgray: t(Chroma.hsl(0, .01, .8), .04),
		white: t(Chroma.hsl(0, .01, 1), .02)
	};
}

interface ColorWith {
	color?: Chroma.Color;
	elevation: number;
	opacity?: number;
	inner?: boolean;
}

function l(props: ColorWith) {
	let { elevation, color: color = Chroma.hsl(0, .01, .07), opacity: opacity = .1, inner: inner = !1 } = props;
	const a = inner ? "inset" : "";
	switch (elevation) {
		case 1:
			return `\n\t\t\t\t\t${a} 0 0 0 1px ${color.alpha(opacity).css()}\n\t\t\t\t`;
		case 2:
			return "\n\t\t\t\t\t".concat(a, " 0 0 0 1px ").concat(color.alpha(opacity).css(), ",\n\t\t\t\t\t").concat(a, " 0 2px 4px ").concat(color.alpha(opacity).css(), "\n\t\t\t\t");
		default:
			return `\n\t\t\t\t\t${a} 0 0 0 1px ${color.alpha(opacity / 2).css()},\n\t\t\t\t\t${a} 0 ${1 * elevation}px ${2 * elevation}px ${color.alpha(opacity).css()},\n\t\t\t\t\t${a} 0 ${3 * elevation}px ${8 * elevation}px ${color.alpha(2 * opacity).css()}\n\t\t\t\t`;
	}
}

export const ThemedBase = {
	light: m(45),
	dark: m(205)
};

const a = {
	light: Chroma("rgb(15, 15, 15)"),
	dark: Chroma("rgb(15, 15, 15)")
};

export function mixColors(colors: string[]) {
	const reverseColors = colors.map(e => Chroma(e)).reverse();
	let n = reverseColors.shift();
	if (!n) {
		return "red";
	}
	for (const reverseColor of reverseColors) {
		const e = reverseColor.alpha();
		const t: number = n.alpha();
		if (1 === e) {
			n = reverseColor;
			continue;
		}
		const i = Math.min(e + t, 1);
		const a = e / t;
		n = Chroma.mix(n.alpha(1), reverseColor.alpha(1), a).alpha(i);
	}
	return n.css();
}

export const ThemedColors = {
	inherit: "inherit",
	transparent: "transparent",
	black: "black",
	white: "white",
	red: "#EB5757",
	blue: "#2EAADC",
	contentBorder: "#E4E3E2",
	contentGrayBackground: "#F7F6F5",
	contentPlaceholder: "#C4C4C4",
	defaultText: "rgb(66, 66, 65)",
	uiBlack: "#333",
	uiExtraLightGray: "#E2E2E2",
	uiGray: "#A5A5A5",
	uiLightBlack: "#888",
	uiLightBorder: "#F2F1F0",
	uiLightGray: "#C4C4C4",
	regularTextColor: defaultLightWithAlpha(1),
};

export const ThemedStyles = {

	mode: {
		light: "light",
		dark: "dark"
	},
	regularTextColor: {
		light: defaultLightWithAlpha(1),
		dark: defaultDarkWithAlpha(.9)
	},
	mediumTextColor: {
		light: defaultLightWithAlpha(.6),
		dark: defaultDarkWithAlpha(.6)
	},
	lightTextColor: {
		light: defaultLightWithAlpha(.4),
		dark: defaultDarkWithAlpha(.4)
	},
	regularInvertedTextColor: {
		light: ThemedBase.light.white.alpha(.9).css(),
		dark: ThemedBase.dark.black.alpha(1).css()
	},

	regularIconColor: {
		light: defaultLightWithAlpha(.8),
		dark: ThemedBase.dark.lightgray.alpha(1).css()
	},
	mediumIconColor: {
		light: defaultLightWithAlpha(.4),
		dark: ThemedBase.dark.lightgray.alpha(.6).hex()
	},
	lightIconColor: {
		light: defaultLightWithAlpha(.3),
		dark: ThemedBase.dark.lightgray.alpha(.4).css()
	},

	regularDividerColor: {
		light: ThemedBase.light.darkgray.alpha(.09).css(),
		dark: ThemedBase.dark.white.alpha(.07).css()
	},

	darkDividerColor: {
		light: ThemedBase.light.darkgray.alpha(.16).hex(),
		dark: ThemedBase.dark.white.alpha(.14).hex()
	},

	sidebarTextColor: {
		light: "rgba(25, 2, 17, 0.6)",
		dark: "rgba(255, 255, 255, 0.6)"
	},
	sidebarBackground: {
		light: "rgb(247, 246, 243)",
		dark: 'rgb(37,37,38)',
	},
	sidebarSwitcherFooterBackground: {
		light: "#FBFAF9",
		dark: "#404447"
	},
	floatingSidebarBackground: {
		light: ThemedColors.white,
		dark: "rgb(55, 60, 63)"
	},
	onboardingBackground: {
		light: "rgb(247, 246, 243)",
		dark: "rgb(55, 60, 63)"
	},
	buttonHoveredBackground: {
		light: ThemedBase.light.darkgray.alpha(.08).hex(),
		dark: ThemedBase.dark.darkgray.brighten(.6).hex()
	},

	buttonPressedBackground: {
		light: ThemedBase.light.darkgray.alpha(.16).css(),
		dark: ThemedBase.dark.darkgray.brighten(.4).css()
	},

	blueButtonHoveredBackground: {
		light: darkenWithAlpha(ThemedColors.blue, .3),
		dark: darkenWithAlpha(ThemedColors.blue, .3)
	},

	blueButtonPressedBackground: {
		light: darkenWithAlpha(ThemedColors.blue, .6),
		dark: darkenWithAlpha(ThemedColors.blue, .6)
	},

	outlineButtonBorder: {
		light: ThemedBase.light.darkgray.alpha(.16).css(),
		dark: ThemedBase.dark.white.brighten(.14).css()
	},

	outlineBlueButtonHoveredBackground: {
		light: "rgba(46, 170, 220, 0.1)",
		dark: defaultDarkWithAlpha(.1)
	},

	outlineBlueButtonPressedBackground: {
		light: "rgba(46, 170, 220, 0.2)",
		dark: defaultDarkWithAlpha(.2)
	},

	outlinefrontSecondaryButtonHoveredBackground: {
		light: redWithAlpha(.1),
		dark: redWithAlpha(.1)
	},

	outlinefrontSecondaryButtonPressedBackground: {
		light: redWithAlpha(.2),
		dark: redWithAlpha(.2)
	},

	contentBackground: {
		light: ThemedColors.white,
		dark: 'rgb(30,30,30)'
	},

	codeBlockBackground: {
		light: "rgb(247, 246, 243)",
		dark: "rgb(63, 68, 71)",
	},

	popoverBackground: {
		light: ThemedColors.white,
		dark: ThemedBase.dark.darkgray.brighten(.4).css()
	},

	inputBackground: {
		light: "rgba(242,241,238,0.6)",
		dark: ThemedBase.dark.black.alpha(.3).css()
	},

	tooltipBackground: {
		light: ThemedBase.light.black.css(),
		dark: ThemedBase.dark.lightgray.css()
	},

	mediumBoxShadow: {
		light: l({
			elevation: 3,
			color: a.light,
			opacity: .1
		}),
		dark: l({
			elevation: 3,
			color: a.dark,
			opacity: .2
		})
	},

	lightBoxShadow: {
		light: l({
			elevation: 2,
			color: a.light,
			opacity: .1
		}),
		dark: l({
			elevation: 2,
			color: a.dark,
			opacity: .2
		})
	},

	inputBoxShadow: {
		light: l({
			elevation: 1,
			color: a.light,
			opacity: .1,
			inner: !0
		}),
		dark: l({
			elevation: 1,
			color: a.dark,
			opacity: .2,
			inner: !0
		})
	},

	buttonBoxShadow: {
		light: "inset 0 0 0 1px ".concat(a.light.alpha(.1).css(), ", 0 1px 2px ").concat(a.light.alpha(.1).css()),
		dark: "inset 0 0 0 1px ".concat(a.dark.alpha(.2).css(), ", 0 1px 2px ").concat(a.dark.alpha(.1).css())
	},

	borderBoxShadow: {
		light: "0 0 0 1px ".concat(a.light.alpha(.1).css()),
		dark: "0 0 0 1px ".concat(a.dark.alpha(.2).css())
	},

	blueColor: {
		light: "rgb(46, 170, 220)",
		dark: defaultDarkWithAlpha(.9)
	},
}

export const ThemedShadow = {
	mediumBoxShadow: {
		light: l({
			elevation: 3,
			color: a.light,
			opacity: .1
		}),
		dark: l({
			elevation: 3,
			color: a.dark,
			opacity: .2
		})
	},
	shadowColor: {
		light: a.light,
		dark: a.dark
	},
	shadowOpacity: {
		light: .1,
		dark: .2
	},
}
