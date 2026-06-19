import { ROUTES } from "../shared/constants.js";

export function resolveRoute(route, state) {
  const normalizedRoute = normalizeRoute(route);

  if (normalizedRoute === ROUTES.HOME) {
    return { route: ROUTES.NICKNAME, redirectTo: ROUTES.NICKNAME };
  }

  if (normalizedRoute === ROUTES.NICKNAME) {
    if (state.game) {
      return { route: ROUTES.GAME, redirectTo: ROUTES.GAME };
    }
    if (state.joinedNickname) {
      return { route: ROUTES.LOBBY, redirectTo: ROUTES.LOBBY };
    }
    return { route: ROUTES.NICKNAME };
  }

  if (normalizedRoute === ROUTES.LOBBY) {
    if (state.game) {
      return { route: ROUTES.GAME, redirectTo: ROUTES.GAME };
    }
    if (!state.joinedNickname) {
      return { route: ROUTES.NICKNAME, redirectTo: ROUTES.NICKNAME };
    }
    return { route: ROUTES.LOBBY };
  }

  if (normalizedRoute === ROUTES.GAME) {
    if (!state.game) {
      return {
        route: state.joinedNickname ? ROUTES.LOBBY : ROUTES.NICKNAME,
        redirectTo: state.joinedNickname ? ROUTES.LOBBY : ROUTES.NICKNAME
      };
    }
    return { route: ROUTES.GAME };
  }

  if (normalizedRoute === ROUTES.WINNER) {
    if (!state.matchResult) {
      const fallbackRoute = state.game
        ? ROUTES.GAME
        : state.joinedNickname
          ? ROUTES.LOBBY
          : ROUTES.NICKNAME;
      return { route: fallbackRoute, redirectTo: fallbackRoute };
    }
    return { route: ROUTES.WINNER };
  }

  return { route: "not-found" };
}

export function normalizeRoute(route) {
  if (!route || typeof route !== "string") return ROUTES.HOME;
  return route.startsWith("/") ? route : `/${route}`;
}
