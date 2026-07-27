import {
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  useLocation,
  useNavigationType,
} from "react-router-dom";

import { NAV_ITEMS } from "../navigation/navigationConfig";

const APPLICATION_NAME = "Semantix";
const NOT_FOUND_TITLE = `Page not found | ${APPLICATION_NAME}`;

function titleForPath(pathname: string): string {
  const route = NAV_ITEMS.find(({ to }) =>
    to === "/"
      ? pathname === to
      : pathname === to || pathname.startsWith(`${to}/`),
  );

  return route === undefined
    ? NOT_FOUND_TITLE
    : `${route.label} | ${APPLICATION_NAME}`;
}

export function useRouteAccessibility(
  mainRef: RefObject<HTMLElement>,
): void {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const pathChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (pathChanged && navigationType === "PUSH") {
      mainRef.current?.focus();
    }
  }, [mainRef, navigationType, pathname]);
}
