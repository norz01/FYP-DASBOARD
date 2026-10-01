/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/[...proxy]/route";
exports.ids = ["app/api/[...proxy]/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2F%5B...proxy%5D%2Froute&page=%2Fapi%2F%5B...proxy%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2F%5B...proxy%5D%2Froute.js&appDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!":
/*!******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2F%5B...proxy%5D%2Froute&page=%2Fapi%2F%5B...proxy%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2F%5B...proxy%5D%2Froute.js&appDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D! ***!
  \******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _home_genn_Documents_DEVs_FYP_FYP_DASBOARD_main_src_app_api_proxy_route_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/app/api/[...proxy]/route.js */ \"(rsc)/./src/app/api/[...proxy]/route.js\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"standalone\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/[...proxy]/route\",\n        pathname: \"/api/[...proxy]\",\n        filename: \"route\",\n        bundlePath: \"app/api/[...proxy]/route\"\n    },\n    resolvedPagePath: \"/home/genn/Documents/DEVs/FYP/FYP-DASBOARD-main/src/app/api/[...proxy]/route.js\",\n    nextConfigOutput,\n    userland: _home_genn_Documents_DEVs_FYP_FYP_DASBOARD_main_src_app_api_proxy_route_js__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkYlNUIuLi5wcm94eSU1RCUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGJTVCLi4ucHJveHklNUQlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkYlNUIuLi5wcm94eSU1RCUyRnJvdXRlLmpzJmFwcERpcj0lMkZob21lJTJGZ2VubiUyRkRvY3VtZW50cyUyRkRFVnMlMkZGWVAlMkZGWVAtREFTQk9BUkQtbWFpbiUyRnNyYyUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGaG9tZSUyRmdlbm4lMkZEb2N1bWVudHMlMkZERVZzJTJGRllQJTJGRllQLURBU0JPQVJELW1haW4maXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9c3RhbmRhbG9uZSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUErRjtBQUN2QztBQUNxQjtBQUMrQjtBQUM1RztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiL2hvbWUvZ2Vubi9Eb2N1bWVudHMvREVWcy9GWVAvRllQLURBU0JPQVJELW1haW4vc3JjL2FwcC9hcGkvWy4uLnByb3h5XS9yb3V0ZS5qc1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJzdGFuZGFsb25lXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL1suLi5wcm94eV0vcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS9bLi4ucHJveHldXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9bLi4ucHJveHldL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiL2hvbWUvZ2Vubi9Eb2N1bWVudHMvREVWcy9GWVAvRllQLURBU0JPQVJELW1haW4vc3JjL2FwcC9hcGkvWy4uLnByb3h5XS9yb3V0ZS5qc1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHdvcmtBc3luY1N0b3JhZ2UsXG4gICAgICAgIHdvcmtVbml0QXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2F%5B...proxy%5D%2Froute&page=%2Fapi%2F%5B...proxy%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2F%5B...proxy%5D%2Froute.js&appDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(rsc)/./src/app/api/[...proxy]/route.js":
/*!*****************************************!*\
  !*** ./src/app/api/[...proxy]/route.js ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   DELETE: () => (/* binding */ DELETE),\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   PATCH: () => (/* binding */ PATCH),\n/* harmony export */   POST: () => (/* binding */ POST),\n/* harmony export */   PUT: () => (/* binding */ PUT)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_headers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/headers */ \"(rsc)/./node_modules/next/dist/api/headers.js\");\n\n\nconst BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';\nasync function proxyRequest(request, { params }) {\n    const path = (await params).proxy?.join('/') || '';\n    const url = new URL(request.url);\n    const queryString = url.search;\n    const targetUrl = `${BACKEND_URL}/api/${path}${queryString}`;\n    const cookieStore = await (0,next_headers__WEBPACK_IMPORTED_MODULE_1__.cookies)();\n    const token = cookieStore.get('ikmbToken')?.value;\n    const headers = new Headers();\n    for (const [key, value] of request.headers.entries()){\n        if (![\n            'host',\n            'connection',\n            'content-length',\n            'cookie'\n        ].includes(key.toLowerCase())) {\n            headers.set(key, value);\n        }\n    }\n    if (token) {\n        headers.set('Authorization', `Bearer ${token}`);\n    }\n    try {\n        const body = await request.arrayBuffer();\n        const response = await fetch(targetUrl, {\n            method: request.method,\n            headers,\n            body: body.byteLength > 0 ? body : undefined\n        });\n        const responseBody = await response.arrayBuffer();\n        return new next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse(responseBody, {\n            status: response.status,\n            headers: response.headers\n        });\n    } catch (error) {\n        console.error('API proxy error:', error);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            message: 'Gagal menyambung ke pelayan.'\n        }, {\n            status: 502\n        });\n    }\n}\nasync function GET(request, context) {\n    return proxyRequest(request, context);\n}\nasync function POST(request, context) {\n    return proxyRequest(request, context);\n}\nasync function PUT(request, context) {\n    return proxyRequest(request, context);\n}\nasync function PATCH(request, context) {\n    return proxyRequest(request, context);\n}\nasync function DELETE(request, context) {\n    return proxyRequest(request, context);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvYXBwL2FwaS9bLi4ucHJveHldL3JvdXRlLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBMkM7QUFDSjtBQUV2QyxNQUFNRSxjQUFjQyxRQUFRQyxHQUFHLENBQUNGLFdBQVcsSUFBSTtBQUUvQyxlQUFlRyxhQUFhQyxPQUFPLEVBQUUsRUFBRUMsTUFBTSxFQUFFO0lBQzdDLE1BQU1DLE9BQU8sQ0FBQyxNQUFNRCxNQUFLLEVBQUdFLEtBQUssRUFBRUMsS0FBSyxRQUFRO0lBQ2hELE1BQU1DLE1BQU0sSUFBSUMsSUFBSU4sUUFBUUssR0FBRztJQUMvQixNQUFNRSxjQUFjRixJQUFJRyxNQUFNO0lBQzlCLE1BQU1DLFlBQVksR0FBR2IsWUFBWSxLQUFLLEVBQUVNLE9BQU9LLGFBQWE7SUFFNUQsTUFBTUcsY0FBYyxNQUFNZixxREFBT0E7SUFDakMsTUFBTWdCLFFBQVFELFlBQVlFLEdBQUcsQ0FBQyxjQUFjQztJQUU1QyxNQUFNQyxVQUFVLElBQUlDO0lBQ3BCLEtBQUssTUFBTSxDQUFDQyxLQUFLSCxNQUFNLElBQUliLFFBQVFjLE9BQU8sQ0FBQ0csT0FBTyxHQUFJO1FBQ3BELElBQUksQ0FBQztZQUFDO1lBQVE7WUFBYztZQUFrQjtTQUFTLENBQUNDLFFBQVEsQ0FBQ0YsSUFBSUcsV0FBVyxLQUFLO1lBQ25GTCxRQUFRTSxHQUFHLENBQUNKLEtBQUtIO1FBQ25CO0lBQ0Y7SUFFQSxJQUFJRixPQUFPO1FBQ1RHLFFBQVFNLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUVULE9BQU87SUFDaEQ7SUFFQSxJQUFJO1FBQ0YsTUFBTVUsT0FBTyxNQUFNckIsUUFBUXNCLFdBQVc7UUFDdEMsTUFBTUMsV0FBVyxNQUFNQyxNQUFNZixXQUFXO1lBQ3RDZ0IsUUFBUXpCLFFBQVF5QixNQUFNO1lBQ3RCWDtZQUNBTyxNQUFNQSxLQUFLSyxVQUFVLEdBQUcsSUFBSUwsT0FBT007UUFDckM7UUFFQSxNQUFNQyxlQUFlLE1BQU1MLFNBQVNELFdBQVc7UUFDL0MsT0FBTyxJQUFJNUIscURBQVlBLENBQUNrQyxjQUFjO1lBQ3BDQyxRQUFRTixTQUFTTSxNQUFNO1lBQ3ZCZixTQUFTUyxTQUFTVCxPQUFPO1FBQzNCO0lBQ0YsRUFBRSxPQUFPZ0IsT0FBTztRQUNkQyxRQUFRRCxLQUFLLENBQUMsb0JBQW9CQTtRQUNsQyxPQUFPcEMscURBQVlBLENBQUNzQyxJQUFJLENBQUM7WUFBRUMsU0FBUztRQUErQixHQUFHO1lBQUVKLFFBQVE7UUFBSTtJQUN0RjtBQUNGO0FBRU8sZUFBZUssSUFBSWxDLE9BQU8sRUFBRW1DLE9BQU87SUFDeEMsT0FBT3BDLGFBQWFDLFNBQVNtQztBQUMvQjtBQUVPLGVBQWVDLEtBQUtwQyxPQUFPLEVBQUVtQyxPQUFPO0lBQ3pDLE9BQU9wQyxhQUFhQyxTQUFTbUM7QUFDL0I7QUFFTyxlQUFlRSxJQUFJckMsT0FBTyxFQUFFbUMsT0FBTztJQUN4QyxPQUFPcEMsYUFBYUMsU0FBU21DO0FBQy9CO0FBRU8sZUFBZUcsTUFBTXRDLE9BQU8sRUFBRW1DLE9BQU87SUFDMUMsT0FBT3BDLGFBQWFDLFNBQVNtQztBQUMvQjtBQUVPLGVBQWVJLE9BQU92QyxPQUFPLEVBQUVtQyxPQUFPO0lBQzNDLE9BQU9wQyxhQUFhQyxTQUFTbUM7QUFDL0IiLCJzb3VyY2VzIjpbIi9ob21lL2dlbm4vRG9jdW1lbnRzL0RFVnMvRllQL0ZZUC1EQVNCT0FSRC1tYWluL3NyYy9hcHAvYXBpL1suLi5wcm94eV0vcm91dGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInO1xuaW1wb3J0IHsgY29va2llcyB9IGZyb20gJ25leHQvaGVhZGVycyc7XG5cbmNvbnN0IEJBQ0tFTkRfVVJMID0gcHJvY2Vzcy5lbnYuQkFDS0VORF9VUkwgfHwgJ2h0dHA6Ly8xMjcuMC4wLjE6NTAwMCc7XG5cbmFzeW5jIGZ1bmN0aW9uIHByb3h5UmVxdWVzdChyZXF1ZXN0LCB7IHBhcmFtcyB9KSB7XG4gIGNvbnN0IHBhdGggPSAoYXdhaXQgcGFyYW1zKS5wcm94eT8uam9pbignLycpIHx8ICcnO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKTtcbiAgY29uc3QgcXVlcnlTdHJpbmcgPSB1cmwuc2VhcmNoO1xuICBjb25zdCB0YXJnZXRVcmwgPSBgJHtCQUNLRU5EX1VSTH0vYXBpLyR7cGF0aH0ke3F1ZXJ5U3RyaW5nfWA7XG5cbiAgY29uc3QgY29va2llU3RvcmUgPSBhd2FpdCBjb29raWVzKCk7XG4gIGNvbnN0IHRva2VuID0gY29va2llU3RvcmUuZ2V0KCdpa21iVG9rZW4nKT8udmFsdWU7XG5cbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHJlcXVlc3QuaGVhZGVycy5lbnRyaWVzKCkpIHtcbiAgICBpZiAoIVsnaG9zdCcsICdjb25uZWN0aW9uJywgJ2NvbnRlbnQtbGVuZ3RoJywgJ2Nvb2tpZSddLmluY2x1ZGVzKGtleS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgaGVhZGVycy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRva2VuKSB7XG4gICAgaGVhZGVycy5zZXQoJ0F1dGhvcml6YXRpb24nLCBgQmVhcmVyICR7dG9rZW59YCk7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0LmFycmF5QnVmZmVyKCk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0YXJnZXRVcmwsIHtcbiAgICAgIG1ldGhvZDogcmVxdWVzdC5tZXRob2QsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keTogYm9keS5ieXRlTGVuZ3RoID4gMCA/IGJvZHkgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZUJvZHkgPSBhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpO1xuICAgIHJldHVybiBuZXcgTmV4dFJlc3BvbnNlKHJlc3BvbnNlQm9keSwge1xuICAgICAgc3RhdHVzOiByZXNwb25zZS5zdGF0dXMsXG4gICAgICBoZWFkZXJzOiByZXNwb25zZS5oZWFkZXJzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FQSSBwcm94eSBlcnJvcjonLCBlcnJvcik7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgbWVzc2FnZTogJ0dhZ2FsIG1lbnlhbWJ1bmcga2UgcGVsYXlhbi4nIH0sIHsgc3RhdHVzOiA1MDIgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1ZXN0LCBjb250ZXh0KSB7XG4gIHJldHVybiBwcm94eVJlcXVlc3QocmVxdWVzdCwgY29udGV4dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3QsIGNvbnRleHQpIHtcbiAgcmV0dXJuIHByb3h5UmVxdWVzdChyZXF1ZXN0LCBjb250ZXh0KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBVVChyZXF1ZXN0LCBjb250ZXh0KSB7XG4gIHJldHVybiBwcm94eVJlcXVlc3QocmVxdWVzdCwgY29udGV4dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBQQVRDSChyZXF1ZXN0LCBjb250ZXh0KSB7XG4gIHJldHVybiBwcm94eVJlcXVlc3QocmVxdWVzdCwgY29udGV4dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBERUxFVEUocmVxdWVzdCwgY29udGV4dCkge1xuICByZXR1cm4gcHJveHlSZXF1ZXN0KHJlcXVlc3QsIGNvbnRleHQpO1xufVxuIl0sIm5hbWVzIjpbIk5leHRSZXNwb25zZSIsImNvb2tpZXMiLCJCQUNLRU5EX1VSTCIsInByb2Nlc3MiLCJlbnYiLCJwcm94eVJlcXVlc3QiLCJyZXF1ZXN0IiwicGFyYW1zIiwicGF0aCIsInByb3h5Iiwiam9pbiIsInVybCIsIlVSTCIsInF1ZXJ5U3RyaW5nIiwic2VhcmNoIiwidGFyZ2V0VXJsIiwiY29va2llU3RvcmUiLCJ0b2tlbiIsImdldCIsInZhbHVlIiwiaGVhZGVycyIsIkhlYWRlcnMiLCJrZXkiLCJlbnRyaWVzIiwiaW5jbHVkZXMiLCJ0b0xvd2VyQ2FzZSIsInNldCIsImJvZHkiLCJhcnJheUJ1ZmZlciIsInJlc3BvbnNlIiwiZmV0Y2giLCJtZXRob2QiLCJieXRlTGVuZ3RoIiwidW5kZWZpbmVkIiwicmVzcG9uc2VCb2R5Iiwic3RhdHVzIiwiZXJyb3IiLCJjb25zb2xlIiwianNvbiIsIm1lc3NhZ2UiLCJHRVQiLCJjb250ZXh0IiwiUE9TVCIsIlBVVCIsIlBBVENIIiwiREVMRVRFIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/app/api/[...proxy]/route.js\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2F%5B...proxy%5D%2Froute&page=%2Fapi%2F%5B...proxy%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2F%5B...proxy%5D%2Froute.js&appDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fgenn%2FDocuments%2FDEVs%2FFYP%2FFYP-DASBOARD-main&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();