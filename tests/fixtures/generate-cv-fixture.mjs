import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  h1: { fontSize: 16, marginBottom: 8 },
  h2: { fontSize: 12, marginTop: 12, marginBottom: 4 },
})

const doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.h1 }, 'Lebenslauf - Max Mustermann'),
    React.createElement(Text, null, 'Senior Strategy Consultant'),
    React.createElement(Text, { style: styles.h2 }, 'Ausbildung'),
    React.createElement(
      View,
      null,
      React.createElement(Text, null, 'RWTH Aachen - M.Sc. Maschinenbau, 2014 - 2019'),
      React.createElement(Text, null, 'Austauschjahr an der Tsinghua University, Peking, 2017 - 2018')
    ),
    React.createElement(Text, { style: styles.h2 }, 'Berufserfahrung'),
    React.createElement(
      View,
      null,
      React.createElement(Text, null, 'McKinsey & Company - Senior Consultant, Muenchen, seit 2021'),
      React.createElement(Text, null, 'Boston Consulting Group - Associate, Berlin, 2019 - 2021')
    ),
    React.createElement(Text, { style: styles.h2 }, 'Skills'),
    React.createElement(Text, null, 'Strategieberatung, Datenanalyse, Projektmanagement'),
    React.createElement(Text, { style: styles.h2 }, 'Sprachen'),
    React.createElement(Text, null, 'Deutsch, Englisch, Mandarin')
  )
)

const buffer = await renderToBuffer(doc)
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-cv.pdf')
writeFileSync(outPath, buffer)
console.log(`Wrote ${outPath} (${buffer.length} bytes)`)
