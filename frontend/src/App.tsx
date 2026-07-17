import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { RouteLoader } from "./components/navigation/RouteLoader";
import { AppLayout } from "./layouts/AppLayout";
import routes from "./routes";

function renderRoute(route: (typeof routes)[number]): JSX.Element {
  const Component = route.component;
  const element = (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  );

  if ("index" in route) {
    return <Route key={route.key} index element={element} />;
  }

  return (
    <Route
      key={route.key}
      path={route.path}
      element={element}
    />
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>{routes.map(renderRoute)}</Route>
    </Routes>
  );
}
