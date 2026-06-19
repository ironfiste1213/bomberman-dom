import { ROUTES } from "../shared/constants.js";

const NOT_FOUND_ROUTE = "not-found";

export function resolveRoute(route, state = {}) {

  const normalizedRoute = normalizeRoute(route);

  switch (normalizedRoute) {

    case ROUTES.HOME:

      return redirectTo(ROUTES.NICKNAME);

    case ROUTES.NICKNAME:

      if (state.game) return redirectTo(ROUTES.GAME);
      if (state.joinedNickname) return redirectTo(ROUTES.LOBBY);
      return allowRoute(ROUTES.NICKNAME);

    case ROUTES.LOBBY:

      if (state.game) return redirectTo(ROUTES.GAME);

      if (!state.joinedNickname) return redirectTo(ROUTES.NICKNAME);

      return allowRoute(ROUTES.LOBBY);

    case ROUTES.GAME:

      if (!state.game) return redirectTo(joinedFallbackRoute(state));

      return allowRoute(ROUTES.GAME);

    case ROUTES.WINNER:

      if (!state.matchResult) return redirectTo(activeFallbackRoute(state));

      return allowRoute(ROUTES.WINNER);

    default:

      return allowRoute(NOT_FOUND_ROUTE);

  }

}

export function normalizeRoute(route) {

  if (!route || typeof route !== "string") return ROUTES.HOME;

  return route.startsWith("/") ? route : `/${route}`;

}

function allowRoute(route) {
  return { route };
}

function redirectTo(route) {
  return { route, redirectTo: route };
}

function joinedFallbackRoute(state) {
  return state.joinedNickname ? ROUTES.LOBBY : ROUTES.NICKNAME;
}

function activeFallbackRoute(state) {
  if (state.game) return ROUTES.GAME;
  return joinedFallbackRoute(state);
}