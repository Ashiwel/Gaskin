/*
 * Untitled UI React (MIT), components/application/empty-state. Adapted for Gaskin: the stock
 * illustrations, file-type icon and avatar decorations are removed (Gaskin draws its own
 * pictograms in src/illustrations), so the bundle stays small.
 */
import type { ComponentPropsWithRef } from "react";
import { createContext, useContext } from "react";
import { SearchLg } from "@untitledui/icons";
import { FeaturedIcon as FeaturedIconbase } from "../../foundations/featured-icon/featured-icon";
import type { BackgroundPatternProps } from "../../shared-assets/background-patterns";
import { BackgroundPattern } from "../../shared-assets/background-patterns";
import { cx } from "../../../utils/cx";

interface RootContextProps {
    /** Scales the whole empty state — the header icon or illustration, the heading and description type, the avatar decorations, and the spacing between the sections. Read by every sub-component through context. */
    size?: "sm" | "md" | "lg";
}

const RootContext = createContext<RootContextProps>({ size: "lg" });

interface RootProps extends ComponentPropsWithRef<"div">, RootContextProps {}

const Root = ({ size = "lg", ...props }: RootProps) => {
    return (
        <RootContext.Provider value={{ size }}>
            <div {...props} className={cx("mx-auto flex w-full max-w-lg flex-col items-center justify-center", props.className)} />
        </RootContext.Provider>
    );
};

const FeaturedIcon = ({ color = "gray", theme = "modern", icon = SearchLg, size, ...props }: ComponentPropsWithRef<typeof FeaturedIconbase>) => {
    const { size: rootSize } = useContext(RootContext);

    return <FeaturedIconbase {...props} {...{ color, theme, icon }} size={!size && rootSize === "lg" ? "xl" : size || "lg"} />;
};

interface HeaderProps extends ComponentPropsWithRef<"div"> {
    /** Decorative background pattern drawn behind the header's icon or illustration and centred on it. Pass `"none"` to render the header without a pattern. */
    pattern?: "none" | BackgroundPatternProps["pattern"];
    /** How far the decorative background pattern extends behind the header content. */
    patternSize?: "sm" | "md" | "lg";
}

const Header = ({ pattern = "circle", patternSize = "md", ...props }: HeaderProps) => {
    const { size } = useContext(RootContext);

    return (
        <header
            {...props}
            className={cx("relative mb-4", (size === "md" || size === "lg") && "mb-5", props.className)}
        >
            {pattern !== "none" && (
                <BackgroundPattern size={patternSize} pattern={pattern} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
            {props.children}
        </header>
    );
};

const Content = (props: ComponentPropsWithRef<"div">) => {
    const { size } = useContext(RootContext);

    return (
        <main
            {...props}
            className={cx(
                "z-10 mb-6 flex w-full max-w-88 flex-col items-center justify-center gap-1",
                (size === "md" || size === "lg") && "mb-8 gap-2",
                props.className,
            )}
        />
    );
};

const Footer = (props: ComponentPropsWithRef<"div">) => {
    return <footer {...props} className={cx("z-10 flex gap-3", props.className)} />;
};

const Title = (props: ComponentPropsWithRef<"h1">) => {
    const { size } = useContext(RootContext);

    return (
        <h1
            {...props}
            className={cx(
                "text-md font-semibold text-primary",
                size === "md" && "text-lg font-semibold",
                size === "lg" && "text-xl font-semibold",
                props.className,
            )}
        />
    );
};

const Description = (props: ComponentPropsWithRef<"p">) => {
    const { size } = useContext(RootContext);

    return <p {...props} className={cx("text-center text-sm text-tertiary", size === "lg" && "text-md", props.className)} />;
};

const EmptyState = Root as typeof Root & {
    Title: typeof Title;
    Header: typeof Header;
    Footer: typeof Footer;
    Content: typeof Content;
    Description: typeof Description;
    FeaturedIcon: typeof FeaturedIcon;
};
EmptyState.Title = Title;
EmptyState.Header = Header;
EmptyState.Footer = Footer;
EmptyState.Content = Content;
EmptyState.Description = Description;
EmptyState.FeaturedIcon = FeaturedIcon;

export { EmptyState };
