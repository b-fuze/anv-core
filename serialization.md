## ANV Serialization
ANV stores task metadata under a `task/.anv` directory.

The `.anv` folder holds all task metadata and extra things like a task cover (image to display for the task), etc

### Contents of `.anv`
 - `cover` an image for the task
 - `meta` JSON file containing the task metadata

### JSON Structure of `.anv/meta`
```js
{
  title: "Task Title",
  cover: "uri://path/to/cover.jpg",
  settings: { ... },

  media: [
    {
      id: 1,
      selected: true,
      fileName: "media.mp4",
      sources: [ 1, 2, ... ],
      source: 1, // ID of the current mediaSource
      ...
    },
    ...
  ],
  mediaSources: [
    {
      id: 1,
      type: "stream",
      url: "uri://path/to/media-source.mp4",
      ...
    },
    ...
  ]
}
```
