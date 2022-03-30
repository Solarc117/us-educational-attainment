import * as d3 from 'https://cdn.skypack.dev/d3@7'
;('use strict')

const canvas = d3.select('.canvas'),
  { clientWidth: canvasW, clientHeight: canvasH } =
    document.querySelector('.canvas'),
  path = d3.geoPath()

let currColor = 0
const colors = [
    'hsl(120, 100%, 19%)',
    'hsl(209, 100%, 19%)',
    'hsl(0, 100%, 19%)',
  ],
  colorScale = d3.scaleLinear([], ['white', colors[currColor]]),
  options = {
    duration: 500,
    fill: 'forwards',
  }
function animate() {
  currColor++
  if (currColor >= colors.length) currColor = 0
  colorScale.range(['white', colors[currColor]])
  const svgs = [
    ...document.querySelectorAll('.county'),
    ...document.querySelectorAll('.legend-rect'),
  ]
  for (const svg of svgs)
    svg.animate(
      [
        {
          fill: colorScale(
            svg.nodeName === 'path'
              ? +svg.dataset.bachelors_or_higher
              : svg.__data__[1]
          ),
        },
      ],
      options
    )
}
document.addEventListener('DOMContentLoaded', () =>
  document.querySelector('.color-toggle').addEventListener('click', animate)
)

// Append legend to bottom right of .canvas.
const numRects = 8,
  legendAxisHeight = 200,
  rectHeight = legendAxisHeight / numRects,
  rectWidth = 20,
  padding = {
    bottom: 10,
    right: 40,
  },
  legendAxisX = canvasW - padding.right + 5,
  legendScale = d3.scaleLinear(
    [],
    [canvasH - padding.bottom, canvasH - padding.bottom - rectHeight * numRects] // For rect positioning (orient bottom-up).
  )

;(async () => {
  let topojsonData, countyInfo
  try {
    ;[topojsonData, countyInfo] = await Promise.all([
      d3.json(
        'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json'
      ),
      d3.json(
        'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json'
      ),
    ])
  } catch (error) {
    console.error(error)
    alert('Could not load data, please try again')
  }

  const countyTopo = topojson.feature(
      topojsonData,
      topojsonData.objects.counties
    ).features,
    stateTopo = topojson.feature(
      topojsonData,
      topojsonData.objects.states
    ).features,
    sortedCountyInfo = [...countyInfo].sort((a, b) => a.fips - b.fips),
    sortedCountyTopo = [...countyTopo].sort((a, b) => a.id - b.id),
    allCountyInfo = []

  for (const [i, info] of sortedCountyInfo.entries()) {
    const topo = sortedCountyTopo[i]

    allCountyInfo.push({
      info: info,
      topo: topo,
    })
  }

  const [minAttainment, maxAttainment] = d3.extent(
      countyInfo,
      countyObj => countyObj.bachelorsOrHigher
    ),
    [minAttRoundDownTens, maxAttRoundUpTens] = [
      10 * Math.floor(minAttainment / 10),
      10 * Math.ceil(maxAttainment / 10),
    ]
  colorScale.domain([minAttainment, maxAttainment])
  legendScale.domain([minAttRoundDownTens, maxAttRoundUpTens])

  function displayCountyInfo({ target }) {
    if (document.querySelector('.tooltip').classList.contains('locked')) return

    const { state, area_name, bachelors_or_higher } = target.dataset
    d3.select('.tooltip').html(
      `${area_name},<br>${state}<br><br>${bachelors_or_higher}%`
    )
  }
  function toggleLocked() {
    document.querySelector('.tooltip').classList.toggle('locked')
  }
  canvas
    .selectAll('.county')
    .data(allCountyInfo)
    .enter()
    .append('path')
    .attr('class', 'county')
    .attr('data-state', county => county.info.state)
    .attr('data-area_name', county => county.info.area_name)
    .attr('data-bachelors_or_higher', county => county.info.bachelorsOrHigher)
    .attr('d', county => path(county.topo))
    .style('fill', county => colorScale(county.info.bachelorsOrHigher))
    .on('mouseover', displayCountyInfo)
    .on('click', toggleLocked)

  canvas
    .selectAll('.state')
    .data(stateTopo)
    .enter()
    .append('path')
    .attr('class', 'state')
    .attr('d', path)

  // Legend.
  const step = (maxAttRoundUpTens - minAttRoundDownTens) / 8,
    rectRanges = []
  for (let i = minAttRoundDownTens; i < maxAttRoundUpTens; i += step) {
    rectRanges.push([i, i + step - 0.01])
  }

  const legendAxis = d3.axisRight(legendScale).tickFormat(val => val + '%')

  canvas
    .append('g')
    .attr('class', 'legend-axis')
    .attr('transform', `translate(${legendAxisX}, 0)`)
    .call(legendAxis)

  // Legend rects, added from bottom-up (lowest ➡ highest attainments).
  function isCurrent(path, range) {
    const percent = +path.dataset.bachelors_or_higher
    return percent >= range[0] && percent <= range[1]
  }
  function determineAction({ target: legendRect, shiftKey, ctrlKey }) {
    const params = [
      legendRect,
      legendRect.__data__, // Range.
      Array.from(document.querySelectorAll('.county')), // Counties.
    ]

    return shiftKey && ctrlKey
      ? fadeAllExceptCurrent(...params)
      : shiftKey
      ? toggleFade(...params)
      : toggleHighlight(...params)
  }
  function fadeAllExceptCurrent(legendRect, range, counties) {
    const insideRange = [],
      outsideRange = [],
      legendRects = Array.from(document.querySelectorAll('.legend-rect'))
    for (const rect of legendRects) rect.classList.add('fade')
    legendRect.classList.remove('fade')
    for (const path of counties)
      isCurrent(path, range) ? insideRange.push(path) : outsideRange.push(path)
    for (const path of insideRange) path.classList.remove('fade')
    for (const path of outsideRange) path.classList.add('fade')
  }
  function toggleFade(legendRect, range, counties) {
    legendRect.classList.toggle('fade')
    counties
      .filter(path => isCurrent(path, range))
      .forEach(path => path.classList.toggle('fade'))
  }
  function toggleHighlight(legendRect, range, counties) {
    legendRect.classList.toggle('highlight')
    counties
      .filter(path => isCurrent(path, range))
      .forEach(path => path.classList.toggle('highlight'))
  }
  canvas
    .selectAll('rect')
    .data(rectRanges)
    .enter()
    .append('rect')
    .attr('width', rectWidth)
    .attr('height', rectHeight)
    .attr('x', canvasW - rectWidth - padding.right)
    .attr('y', range => legendScale(range[1]))
    .attr('class', 'legend-rect')
    .style('fill', range => colorScale(range[1]))
    .on('click', determineAction)
})()
