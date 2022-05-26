import { CSSProperties } from 'mote/base/jsx';
import { createElement } from 'mote/base/jsx/createElement';
import SVGContainer from './svgcontainer';

interface SVGIconProps {
    name: SVGProperty;
    style?: CSSProperties;
}

type SVGProperties = typeof SVGContainer;

export type SVGProperty = keyof SVGProperties;

const container = {
    page: () => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', "g");
        const path = document.createElementNS('http://www.w3.org/2000/svg', "path");
        path.setAttribute("d", "M16,1H4v28h22V11L16,1z M16,3.828L23.172,11H16V3.828z M24,27H6V3h8v10h10V27z M8,17h14v-2H8V17z M8,21h14v-2H8V21z M8,25h14v-2H8V25z")
        g.appendChild(path);
        return g;
    }
}

export default function SVGIcon(props:SVGIconProps) {
    const property = SVGContainer[props.name];
    const {viewBox, className} = property;
    const svg = container[props.name]();
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.display = "block";
    if (props.style) {
        element.style.fill = props.style!.fill as string;
    }
    element.style.flexShrink = "0";
    element.setAttribute("viewBox", viewBox);
    element.classList.add(className);
    element.appendChild(svg);
    return element;

    return createElement("svg", {
        viewBox: viewBox,
        style: Object.assign({
            width: "100%",
            height: "100%",
            display: "block",
            fill: "inherit",
            flexShrink: 0,
            WebkitBackfaceVisibility: "hidden"
        }, props.style),
        className: className
    }, svg)
}