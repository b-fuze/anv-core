# ANV Downloader
ANV is a generic downloader daemon with a focus on downloading lists of ordered media simultaneously. As a daemon it processes instructions from clients (via sockets, IPC, etc) and will manage **tasks**, downloading whatever the tasks requires downloading.

Clients are discussed at the bottom.

ANV's architecture is based around the concept of modules providing the implementations of the varying specific tasks required to facilitate a complete downloading mechanism. ANV is pretty useless by itself without modules to do the specific tasks mentioned, while ANV's purpose is to manage said modules.

Modules register implementations of various facets defined by ANV, the facets available are as follows:
 - `provider`
 - `mirror`
 - `genericresolver`
 - `streamresolver`

## ANV Module Facets
Facets are module implementations of specific tasks that ANV would need to complete a download, and they maintain unique names in each facet.

### Facet Tiers
Facets can expose "tiers," these tiers are exposed to the end user to facilitate a way for the user to rank different methods of processing in the facet.

For example a `provider` facet can expose mirror tiers so the user can decide the priority of each mirror. A `mirror` facet can expose resolution tiers for the user to decide the priority of resolutions (i.e. 360p before 720p or vice versa)

#### `provider` facet
Providers are used to describe providers of media available for download, they take a URL from the provider and return a list of media (episodes for anime) that can be downloaded.

They also provide a way to retrieve mirror or stream URLs for each media (episode) when ANV decides it's time to start downloading it.

#### `mirror` facet
Mirrors are usually separate mini providers that are the actual hosts of media files (e.g episode mp4 files). They take the URL of a media file page and should return a direct URL to the media source (e.g `uri://host/example.mp4`) to be provided to a `streamresolver`

#### Resolver facets
Resolvers are given URLs and are expected to retrieve the data designated by the URLs and run a callback when complete.

#### `genericresolver` facet
Generic resolvers take URLs and return with the full resource for the URL after the request completes.

#### `streamresolver` facet
Stream resolvers take URLs and return streams which are continuously streamed into output streams (usually writable file streams) designated by ANV (episode files) until the stream completes. They also provide the progress of the download if possible.

## Modules
Modules implement the facets and register them with ANV. ANV recognizes modules with the pattern `*.mod.js`, here's an example module exposing a facet and utilizing a `genericresolver`.

### Example module
```js
// example.mod.js
const { register, genericResolver } = require("anv")

register("facet", {
  name: "my-facet-implementation-name",
  ...facetOptions
})

genericResolver("resolvername", {
  ...options
}, function callback(data) { })
```
`register(...)` **must** be invoked immediately when the module is loaded, subsequent invocations (async, etc) will error.

## ANV Module API
Modules can register facets and (if necessary) invoke other facets explicitly (limited to generic resolvers for now, subject to change).

### Provider facet
Duplicate entries indicate variance in values.
```js
register("provider", {
  name: "my-provider",
  displayName: "My Provider",
  description: "Provider description",
  weight: 0,
  cacheSource: true,
  delay: 1000,
  delay(ctx, done) { },
  resolvers: {
    mediaList: "basic",
    mediaSource: "basic"
  },
  hosts: [
    "provider-hostname.com",
  ],
  validUrl(url, list) { },
  tiers: [
    "m:mirror1",
    "m:mirror2",
    "s:streamresolver1",
    "s:streamresolver2",
    "u:uploader"
  ],
  mediaList(metaMediaList) { },
  mediaSource(metaMediaSource) { },
  search(query) { }
})
```
Anime site example: metaMediaList would be the HTML content of the anime page and metaMediaSource would be the HTML content of the episode page.
#### Provider options
  - **name** `string`
    - Unique name of the provider, can only include alpha numeric characters and hyphens.
  - **displayName** `string` _Optional._
  - **description** `string` _Optional._
    - Description of the provider.
  - **weight** `number` _Optional._
    - Weight of the provider (to determine when it should override another provider of the same name)
  - **cacheSource** `boolean` _Optional._ Default: `true`
    - Whether the metaMediaSource for `mediaSource(...)` should be reobtained with a fresh request when querying for different tiers
  - **delay** `function | number` _Optional._ Default: `500`
    - Delay between _any_ requests to this provider. Useful to avoid DDoS-like symptoms on the provider end which may incur an IP ban or similar measures.
      - **delay: `number`**
        - Millisecond delay managed by ANV
      - **delay(ctx, done)**
        - ctx: `object`
          - Delay context. A global context of sorts to be used to aid in the implementation specific delay mechanism
        - done: `function`
          - Called when the delay is over
        - Custom module managed delay
  - **resolvers**
    - mediaList: `string`
      - Generic resolver for the media list
    - mediaSource: `string`
      - Generic resolver for a media source
  - **hosts**
    - Array of host names for the provider. ANV will match initial user download request URL hostnames against this list.
  - **validUrl(url, list)**
    - url: `string`
    - list: `boolean` whether the url is for a list or source
    - _Return:_ `boolean`
  - **tiers** `string[]` _Optional._
    - Array of tiers of different mirrors/streams (if the provider provided direct access to streams)/uploaders. This is a form of ranking the various sources available for a given media to determine which the user deems the more optimal source for ANV to start downloading with.
  - **mediaList(metaMediaList)**
    - metaMediaList: `any`
      - Array data returned from the generic resolver
    - _Return:_ If `mediaSource(...)` isn't omitted, array of URLs to media source items which can be used with `mediaSource(...)` request. Otherwise an array of mediaSourceExample's (see below)
  - **mediaSource(metaMediaSource)** _Optional._
    - metaMediaSource: `any`
      - Data returned from the generic resolver
    - _Return:_ mediaSourceExample (see below)
    - If omitted, `mediaList(...)` is expected to return an array of mediaSourceExample's (see below)
  - **search(query)** _Optional._
    - query: `string`
    - _Return:_ Array of URLs which providers can use to load a `mediaList`

```js
mediaSourceExample: [
  ["stream", "streamresolver", "uri://host/stream.mp4", "uploader"],
  ["mirror", "uri://host/media-page", "uploader"],
  ...
]
```
`"uploader"` can be `null`

### Mirror facet
Duplicate entries indicate variance in values.
```js
register("mirror", {
  name: "my-mirror",
  displayName: "My Mirror",
  description: "Mirror description",
  weight: 0,
  cache: false,
  delay: 1000,
  delay(ctx, done) { },
  resolver: "basic",
  hosts: [
    "mirror-host.com",
  ],
  validUrl(url) { },
  tiers: [
    "360p",
    "720p",
  ],
  media(metaMediaPage, tier) { }
})
```
#### Mirror options
  - **name** `string`
    - Name of the mirror, can only include alphanumeric characters and hyphens.
  - **displayName** `string` _Optional._
  - **description** `string` _Optional._
    - Description of the mirror.
  - **weight** `number` _Optional._
    - Weight of the mirror (to determine when it should override other mirror of the same name)
  - **cache** `boolean` _Optional._ Default: `true`
    - Whether the metaMediaSource for `mediaSource(...)` should be reobtained with a fresh request when querying for different tiers
  - **delay** `function | number` _Optional._ Default: `500`
    - Delay between _any_ requests to this mirror. Useful to avoid DDoS-like symptoms on the mirror end which may incur an IP ban or similar measures.
      - **delay: `number`**
        - Millisecond delay managed by ANV
      - **delay(ctx, done)**
        - ctx: `object`
          - Delay context. A global context of sorts to be used to aid in the implementation specific delay mechanism
        - done: `function`
          - Called when the delay is over
        - Custom module managed delay
  - **resolver** `string`
    - Generic resolver for the mirror
  - **hosts** `string[]`
    - Array of host names for the mirror. ANV will match mirror URL hostnames against this list.
  - **validUrl(url)** _Optional._
    - url: `string`
    - _Return:_ `boolean`
  - **tiers** `string[]` _Optional._
    - Array of generic tiers for the mirror. This is a form of ranking the various tier sources available from the mirror to determine which the user deems the more optimal source for ANV to start downloading with.
  - **media(metaMediaPage, tier)**
    - metaMediaPage: `any`
      - Media page returned from the generic resolver
    - tier: `string | null`
    - _Return:_ Direct url to media (e.g. `uri://host/media.mp4`) to be passed to a stream resolver

### Generic resolver facet
```js
register("genericresolver", {
  name: "my-genericresolver",
  description: "My Generic Resolver",
  resolve(url, done) { }
})
```
#### Generic resolver options
  - **name** `string`
    - Unique name of the generic resolver, can only include alphanumeric characters and hyphens.
  - **description** `string` _Optional._
    - Description of the generic resolver.
  - **resolve(url, done)**
    - url: `string`
      - URL to resource
    - done: `function(err, resource)`
      - err: `string | null`
        - Description of an error if any
      - resource: `any`
      - Callback to call when the resource is ready

### Stream resolver facet
```js
register("streamresolver", {
  name: "my-streamresolver",
  description: "My Stream Resolver",
  weight: 0,
  external: false,
  resolve(url, out, info) {
    const req = request(url)

    return {
      stop() {
        req.end()
      }
    }
  }
})
```
#### Stream resolver options
  - **name** `string`
    - Unique name of the generic resolver, can only include alphanumeric characters and hyphens.
  - **description** `string` _Optional._
    - Description of the stream resolver.
  - **external** `boolean`
    - Whether a external program will manage the download instead
  - **resolve(url, out[, info])**
    - url: `string`
      - URL to resource
    - out: `StreamResolverWritable | string`
      - If `external` is false a Writable stream (See below) managed by ANV, otherwise an absolute path string to the file
    - info: `function(data)` _Optional._
      - data: `object`
        - size: `number`
          - Full size of stream
        - bytes: `number`
          - Bytes saved
      - Function to call when `external` is true to inform ANV of the status of the download. Has no effect if `external` false.
    - _Return:_ `object`
      - stop: `function`
        - Called by ANV to stop downloading (if bytes are still)

### Class: StreamResolverWritable
Inherits `Writable` stream class
#### stream.setSize(size)
 - **size** `number`

Sets the stream size, otherwise it'll be considered indeterminate and the end user won't get a progress bar.

## Clients
ANV works by processing instructions from clients and sending them status updates.

### Example client
```js
const { connect } = require("anv-client")

// Connect to an ANV daemon via ipc
const conn = connect.ipc(childProcess)

// After user input
conn.load(inputUrl).then(task => {
  // Start downloading episodes 1-5
  conn.start(task, task.list.slice(0, 4))

  // User stops task from UI
  conn.stop(task)
})

// Listen for state updates
conn.on("state", state => {
  const {
    tasks,
    daemon
  } = state
})
```
### connect.ws(host)
Initiate a WebSockets connection with an ANV daemon

**Returns:** ANVConnection
### connect.ipc(childProcess)
Initiate an IPC connection with an ANV daemon

**Returns:** ANVConnection

### Class: ANVConnection
Note: Tasks always have the whole media list selected
#### conn.load(url)
  - url: `string`
  - Returns: A promise that returns a new Task on success and throws on failure

#### conn.select(mediaList)
  - mediaList: `ANVMedia[]`
    - Array of media to select for download
  - Selects all the media in the `mediaList` array unselecting any media excluded from the array
  - Returns: A promise that returns a new Task on success and throws on failure

#### conn.start(task)
  - task: `ANVTask`
  - Starts/resumes a task
  - Returns: A promise with the success or failure of starting the task

#### conn.stop(task)
  - task: `ANVTask`
  - Stop/pauses a task
  - Returns: A promise with the success or failure of stop the task

#### conn.delete(media)
  - media: `ANVMedia`
  - Deletes the media file (media will have to be redownloaded from scratch)
  - Returns: A promise with the success or failure of deleting the media file

### Class: ANVTask
#### task.id `number`
Task ID

#### task.list `ANVMedia[]`
Array of ANVMedia items

### Class: ANVMedia
#### media.id `number`

#### media.selected `boolean`

#### media.title `string`
Media title, like `Episode 00`, `Episode 125`, `Episode 2-3`, etc

#### media.fileName `string`

#### media.bytes `number`
Amount of bytes downloaded

#### media.size `number | null`
Can be null if it hasn't started or it started and the size is unknown

#### media.status `string`
Status of the media, can be one of: `"IDLE"`, `"ACTIVE"`, `"PAUSED"`, `"FINISHED"`

#### media.sources `ANVMediaSource[]`
List of sources (mirrors and direct streams) available for this media

#### media.source `number`
Index of the current source being used from `media.sources`

#### media.sourceAttempts `number`
Number of attempts to use the current source, ANV will try the next source when it reaches the max number of attempts

#### media.exhuastedSources `boolean`
Whether ANV tried all the sources and they **all** didn't work

### Class: ANVMediaSource
#### source.type `string`
Either `"mirror"` or `"stream"`

#### source.title `string`

#### source.url `string`
