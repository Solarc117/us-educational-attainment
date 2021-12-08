('use strict');
console.clear();
function log() {
  console.log(...arguments);
}

const canvas = d3.select('.canvas'),
  { clientWidth: canvasW, clientHeight: canvasH } =
    document.querySelector('.canvas'),
  path = d3.geoPath();

let currColor = 0;
const colors = [
    'hsl(120, 100%, 19%)',
    'hsl(209, 100%, 19%)',
    'hsl(0, 100%, 19%)',
  ],
  colorScale = d3.scaleLinear([], ['white', colors[currColor]]),
  options = {
    duration: 500,
    fill: 'forwards',
  };
function animate() {
  currColor++;
  if (currColor >= colors.length) currColor = 0;
  colorScale.range(['white', colors[currColor]]);
  const svgs = [
    ...document.querySelectorAll('.county'),
    ...document.querySelectorAll('.legend-rect'),
  ];
  svgs.forEach(svg =>
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
  );
}
document.addEventListener('DOMContentLoaded', () =>
  document.querySelector('.color-toggle').addEventListener('click', animate)
);

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
  legendAxisY = canvasH - padding.bottom - legendAxisHeight,
  legendScale = d3.scaleLinear(
    [],
    [canvasH - padding.bottom, canvasH - padding.bottom - rectHeight * numRects] // For rect positioning (orient bottom-up).
  );

Promise.all([
  d3.json(
    'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json'
  ),
  d3.json(
    'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json'
  ),
])
  .then(data => {
    const [topojsonData, countyInfo] = data,
      countyTopo = topojson.feature(
        topojsonData,
        topojsonData.objects.counties
      ).features,
      stateTopo = topojson.feature(
        topojsonData,
        topojsonData.objects.states
      ).features,
      sortedCountyInfo = [...countyInfo].sort((a, b) => a.fips - b.fips),
      sortedCountyTopo = [...countyTopo].sort((a, b) => a.id - b.id),
      allCountyInfo = [];
    for (let i = 0; i < sortedCountyInfo.length; i++) {
      const info = sortedCountyInfo[i],
        topo = sortedCountyTopo[i];
      allCountyInfo.push({
        info: info,
        topo: topo,
      });
    }

    const [minAttainment, maxAttainment] = d3.extent(
        countyInfo,
        countyObj => countyObj.bachelorsOrHigher
      ),
      [minAttRoundDownTens, maxAttRoundUpTens] = [
        10 * Math.floor(minAttainment / 10),
        10 * Math.ceil(maxAttainment / 10),
      ];
    colorScale.domain([minAttainment, maxAttainment]);
    legendScale.domain([minAttRoundDownTens, maxAttRoundUpTens]);

    // States are rendered OVER the counties (appended second) so that their borders are visible, but have fill: none; so that the counties under are still accessible (hover-able).
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
      .on('mouseover', event => {
        let { state, area_name, bachelors_or_higher } = event.target.dataset;
        if (!document.querySelector('.tooltip').classList.contains('locked'))
          d3.select('.tooltip').html(
            `${area_name},<br>${state}<br><br>${bachelors_or_higher}%`
          );
      })
      .on('click', () =>
        document.querySelector('.tooltip').classList.toggle('locked')
      );

    canvas
      .selectAll('.state')
      .data(stateTopo)
      .enter()
      .append('path')
      .attr('class', 'state')
      .attr('d', path);

    // Legend.
    const step = (maxAttRoundUpTens - minAttRoundDownTens) / 8,
      rectRanges = [];
    for (let i = minAttRoundDownTens; i < maxAttRoundUpTens; i += step) {
      rectRanges.push([i, i + step - 0.01]);
    }

    const legendAxis = d3.axisRight(legendScale).tickFormat(val => val + '%');

    canvas
      .append('g')
      .attr('class', 'legend-axis')
      .attr('transform', `translate(${legendAxisX}, 0)`)
      .call(legendAxis);

    // Legend rects, added from bottom-up (lowest ➡ highest attainments).
    function isCurrent(path, range) {
      const percent = +path.dataset.bachelors_or_higher;
      return percent >= range[0] && percent <= range[1];
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
      .on('click', event => {
        // Highlight the current rect and relevant paths if click, fade them if click+alt
        const range = event.target.__data__;
        if (event.shiftKey && event.ctrlKey) {
          // Fade all EXCEPT the current rect/paths.
          const insideRange = [],
            outsideRange = [];
          Array.from(document.querySelectorAll('.legend-rect')).forEach(rect =>
            rect.classList.add('fade')
          );
          event.target.classList.remove('fade');
          Array.from(document.querySelectorAll('.county')).forEach(path =>
            // If it is within the current range, add to current. Else, add to others.
            isCurrent(path, range)
              ? insideRange.push(path)
              : outsideRange.push(path)
          );
          insideRange.forEach(path => path.classList.remove('fade'));
          outsideRange.forEach(path => path.classList.add('fade'));
        } else if (event.shiftKey) {
          event.target.classList.toggle('fade');
          Array.from(document.querySelectorAll('.county'))
            .filter(path => isCurrent(path, range))
            .forEach(path => path.classList.toggle('fade'));
        } else {
          event.target.classList.toggle('highlight');
          Array.from(document.querySelectorAll('.county'))
            .filter(path => isCurrent(path, range))
            .forEach(path => path.classList.toggle('highlight'));
        }
      });
  })
  .catch(err => console.error('❌', err));
