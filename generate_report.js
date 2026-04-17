const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  LevelFormat, ExternalHyperlink, TableOfContents
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────────────────
const PROJ = 'C:/Users/sarth/OneDrive/Desktop/projects/UICPS FISAC';

function loadImg(name) {
  return fs.readFileSync(path.join(PROJ, 'figures', name));
}

function tryLoadImg(name) {
  const full = path.join(PROJ, 'figures', name);
  return fs.existsSync(full) ? fs.readFileSync(full) : null;
}

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const W = 9360; // content width DXA (US Letter, 1" margins)

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, color: '1F3864', font: 'Arial' })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: '2E5496', font: 'Arial' })]
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: '2E74B5', font: 'Arial' })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 320 },
    alignment: opts.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    children: [new TextRun({ text, size: 22, font: 'Arial', ...opts })]
  });
}

function bodyJust(text) { return body(text, { justify: true }); }

function para(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 320 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: runs
  });
}

function run(text, opts = {}) {
  return new TextRun({ text, size: 22, font: 'Arial', ...opts });
}

function bold(text) { return run(text, { bold: true }); }
function italic(text) { return run(text, { italics: true }); }
function code(text) { return run(text, { font: 'Courier New', size: 18, color: '1B4F72' }); }

function space(before = 120, after = 80) {
  return new Paragraph({ spacing: { before, after }, children: [new TextRun('')] });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 40, after: 40, line: 280 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })]
  });
}

function equationBox(text) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: { insideH: NO_BORDER, insideV: NO_BORDER },
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: { style: BorderStyle.SINGLE, size: 2, color: '2E74B5' },
                 bottom: { style: BorderStyle.SINGLE, size: 2, color: '2E74B5' },
                 left: { style: BorderStyle.THICK, size: 8, color: '2E74B5' },
                 right: NO_BORDER },
      shading: { fill: 'EBF5FB', type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 200, right: 100 },
      width: { size: W, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, font: 'Courier New', size: 22, bold: true, color: '1A5276' })]
      })]
    })]})],
  });
}

function codeBlock(lines) {
  const rows = lines.map(line => new TableRow({ children: [new TableCell({
    borders: NO_BORDERS,
    margins: { top: 0, bottom: 0, left: 180, right: 100 },
    width: { size: W - 80, type: WidthType.DXA },
    children: [new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: line, font: 'Courier New', size: 18, color: '0D2137' })]
    })]
  })]})
  );
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: { insideH: NO_BORDER, insideV: NO_BORDER },
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: { style: BorderStyle.SINGLE, size: 2, color: '566573' },
                 bottom: { style: BorderStyle.SINGLE, size: 2, color: '566573' },
                 left: { style: BorderStyle.THICK, size: 10, color: '2E86C1' },
                 right: NO_BORDER },
      shading: { fill: 'F2F3F4', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 0, right: 80 },
      width: { size: W, type: WidthType.DXA },
      children: [new Table({
        width: { size: W - 80, type: WidthType.DXA },
        columnWidths: [W - 80],
        borders: { insideH: NO_BORDER, insideV: NO_BORDER },
        rows,
      })]
    })]})],
  });
}

function figure(imgData, type, w, h, caption) {
  if (!imgData) {
    return [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({
        text: '[Figure placeholder: ' + caption + ' — run validate.py to generate]',
        size: 19, italics: true, font: 'Arial', color: '888888'
      })]
    })];
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({
        type, data: imgData,
        transformation: { width: w, height: h },
        altText: { title: caption, description: caption, name: caption }
      })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 160 },
      children: [new TextRun({ text: caption, size: 19, italics: true, font: 'Arial', color: '555555' })]
    })
  ];
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((txt, i) => new TableCell({
      borders: BORDERS,
      shading: isHeader
        ? { fill: '1F3864', type: ShadingType.CLEAR }
        : (i === 0 ? { fill: 'D6E4F0', type: ShadingType.CLEAR } : { fill: 'FFFFFF', type: ShadingType.CLEAR }),
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: txt, size: 20, font: 'Arial',
          bold: isHeader || i === 0,
          color: isHeader ? 'FFFFFF' : '000000'
        })]
      })]
    }))
  });
}

function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      tableRow(headers, true),
      ...rows.map(r => tableRow(r, false))
    ]
  });
}

// ── Images ─────────────────────────────────────────────────────────────────────
const imgLC  = tryLoadImg('learning_curve.png');
const imgAll = tryLoadImg('all_scenarios.png');

const SCENARIO_NAMES = [
  'T_A_in_vs_T_B_in',
  'T_oil_vs_F_A',
  'T_oil_vs_F_B',
  'T_A_in_vs_F_B',
  'T_B_in_vs_F_A',
  'T_oil_vs_T_A_in',
  'T_oil_vs_T_B_in',
];
const SCENARIO_LABELS = [
  'Feed A Temperature vs Feed B Temperature',
  'Hot Oil Bath vs Feed A Flow Rate',
  'Hot Oil Bath vs Feed B Flow Rate',
  'Feed A Temperature vs Feed B Flow Rate',
  'Feed B Temperature vs Feed A Flow Rate',
  'Hot Oil Bath vs Feed A Temperature',
  'Hot Oil Bath vs Feed B Temperature',
];
const scenarioImgs = SCENARIO_NAMES.map((n, i) => tryLoadImg(`scenario_${i+1}_${n}.png`));

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '1F3864' },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '2E5496' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '2E74B5' },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1F3864', space: 1 } },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'UICPS FISAC', size: 18, font: 'Arial', color: '888888', bold: true })]
        })
      ]})
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: '1F3864', space: 1 } },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '888888' }),
          ]
        })
      ]})
    },
    children: [

      // ── TITLE PAGE ──────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1800, after: 160 },
        children: [new TextRun({ text: 'CSTR Deep Reinforcement Learning', bold: true, size: 56, font: 'Arial', color: '1F3864' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: 'Controller', bold: true, size: 56, font: 'Arial', color: '1F3864' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 1200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E74B5', space: 10 } },
        children: [new TextRun({ text: 'UICPS FISAC Report', size: 36, font: 'Arial', color: '2E74B5', italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: 'Team Members', bold: true, size: 26, font: 'Arial', color: '1F3864' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'Member 1', size: 24, font: 'Arial', color: '333333' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'Member 2', size: 24, font: 'Arial', color: '333333' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'Member 3', size: 24, font: 'Arial', color: '333333' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'Member 4', size: 24, font: 'Arial', color: '333333' })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── TABLE OF CONTENTS ───────────────────────────────────────────────────
      new TableOfContents('Table of Contents', {
        hyperlink: true, headingStyleRange: '1-3',
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. AIM ──────────────────────────────────────────────────────────────
      heading1('1.  Aim'),
      bodyJust('The primary aim of this project is to design, implement, and validate a Deep Reinforcement Learning (DRL)-based controller for a Continuous Stirred-Tank Reactor (CSTR) equipped with a hot oil bath heating jacket. Extending the baseline work of Martinez et al. (PSE 2021+), this implementation introduces a full energy balance so that reactor temperature becomes a physically-modelled state variable and five manipulated variables (two feed temperatures, two feed flow rates, and the hot-oil-bath temperature) are available to the controller. The TD3 (Twin Delayed Deep Deterministic Policy Gradient) algorithm trains a single universal agent that regulates the reactor temperature across seven different MV-pairing scenarios, without manual retuning.'),
      space(),
      bodyJust('A key secondary aim is to provide an interactive, real-time simulation dashboard that enables engineers and researchers to visualise the trained agent\'s control behaviour, select between the seven MV-pairing scenarios, inspect manipulated and controlled variables, and evaluate controller performance under stepped setpoint profiles instantly.'),

      // ── 2. OBJECTIVES ───────────────────────────────────────────────────────
      heading1('2.  Objectives'),
      para([run('The following specific objectives were defined to achieve the project aim:')]),
      space(80),
      bullet('Derive and implement a first-principles mathematical model of the CSTR that includes volume, mass, and a full energy balance incorporating convective heat transport, reaction enthalpy, and a hot-oil-bath heating jacket.'),
      bullet('Define five manipulated variables (Feed A temperature, Feed B temperature, Feed A flow rate, Feed B flow rate, Hot oil bath temperature) and implement seven MV-pairing scenarios, each activating two of the five MVs and freezing the remaining three at sensible physical defaults.'),
      bullet('Calibrate the reaction kinetic parameters (k\u2080, Ea/R) using Particle Swarm Optimisation (PSO) against experimental data from the MLAPC laboratory CSTR.'),
      bullet('Implement the TD3 reinforcement learning algorithm from scratch in PyTorch, scaled to a 13-dimensional state vector (including a 5-bit scenario mask) and a 5-dimensional continuous action space.'),
      bullet('Train a single universal TD3 agent over 10,000 episodes with uniform sampling across the seven scenarios, using GPU acceleration.'),
      bullet('Validate the trained controller by running each of the seven scenarios with a scripted stepped reactor-temperature setpoint profile (32 \u2192 40 \u2192 45 \u2192 36 \u2192 42 \u00b0C), generating one tracking figure per scenario.'),
      bullet('Deploy an interactive Streamlit dashboard that allows real-time simulation runs with selectable scenarios, adjustable setpoints, and model checkpoints.'),
      bullet('Document all findings, equations, code, and results in a comprehensive technical report.'),

      // ── 3. METHODOLOGY ──────────────────────────────────────────────────────
      heading1('3.  Methodology'),

      heading2('3.1  Process Description \u2014 The CSTR with Hot Oil Bath'),
      bodyJust('The Continuous Stirred-Tank Reactor (CSTR) considered in this work carries out an exothermic first-order reaction A \u2192 B. The reactor receives two inlet streams (Feed A and Feed B) with different reactant concentrations and temperatures, and discharges product by gravity through an outlet valve. A hot-oil-bath heating jacket surrounds the reactor and provides the thermal driving force for the reaction. Heat enters through the jacket at a rate proportional to the difference between the bath temperature and the reactor temperature; additional heat is released by the exothermic chemistry.'),
      space(),
      makeTable(
        ['Variable', 'Symbol', 'Value / Range', 'Units'],
        [
          ['Cross-sectional area', 'A_tank', '1.0', 'm\u00b2'],
          ['Maximum level', 'H_max', '3.0', 'm'],
          ['Gravity outlet coefficient', 'c_v', '0.8', 'm\u00b2\u00b7\u00b5/h'],
          ['Feed A inlet flow (manipulated)', 'F_A', '0 \u2013 2.0', 'm\u00b3/h'],
          ['Feed B inlet flow (manipulated)', 'F_B', '0 \u2013 2.0', 'm\u00b3/h'],
          ['Feed A temperature (manipulated)', 'T_A_in', '288 \u2013 353 (15\u201380 \u00b0C)', 'K'],
          ['Feed B temperature (manipulated)', 'T_B_in', '288 \u2013 353 (15\u201380 \u00b0C)', 'K'],
          ['Hot oil bath temperature (manipulated)', 'T_oil', '303 \u2013 393 (30\u2013120 \u00b0C)', 'K'],
          ['Feed A concentration', 'C_A,in1', '1.0', 'kmol/m\u00b3'],
          ['Feed B concentration', 'C_A,in2', '0.5', 'kmol/m\u00b3'],
          ['Density (liquid, water-like)', '\u03c1', '1000', 'kg/m\u00b3'],
          ['Heat capacity (liquid)', 'C_p', '4.18', 'kJ/(kg\u00b7K)'],
          ['Heat of reaction', '\u0394H_rxn', '\u22125 \u00d7 10\u2074', 'kJ/kmol'],
          ['Jacket heat-transfer term', 'UA', '2000', 'kJ/(h\u00b7K)'],
          ['Pre-exponential factor (PSO)', 'k\u2080', '1.85 \u00d7 10\u2077', 'h\u207b\u00b9'],
          ['Activation energy / R (PSO)', 'E_a/R', '2352.61', 'K'],
        ],
        [2800, 1400, 2300, 860]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 1 \u2014 CSTR Physical, Thermal, and Kinetic Parameters', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.2  First-Principles Mathematical Model'),
      bodyJust('The CSTR dynamics are derived from fundamental conservation laws and extended from the UICPS FISAC First Principle Model Draft with an energy balance on the reactor liquid. Four coupled ordinary differential equations (ODEs) fully describe the reactor state: a volume balance, a mass balance on reactant A, a mass balance on product B, and an energy balance on the liquid enthalpy.'),
      space(),

      heading3('3.2.1  Volume Balance'),
      bodyJust('The rate of change of liquid level H is determined by the net volumetric flow into the reactor. The outlet flow is gravity-driven and proportional to the square root of the level (Torricelli\'s law):'),
      space(80),
      equationBox('dH/dt = ( F_A(t) + F_B(t) - F_out(H) ) / A_tank'),
      space(60),
      equationBox('F_out(H) = c_v * sqrt(H)'),
      space(),
      bodyJust('where F_A and F_B are the two time-varying inlet flows, and c_v is the outlet valve coefficient. A level safety controller transparently overrides F_A/F_B when H leaves the safe band [0.5 m, 2.5 m] so that the agent\'s reward remains focused on temperature tracking.'),

      heading3('3.2.2  Mass Balance on Reactant A'),
      bodyJust('The concentration of reactant A changes due to convective in/out flows and is consumed by the first-order reaction A \u2192 B with rate k(T):'),
      space(80),
      equationBox('dC_A/dt = [ F_A C_A,in1 + F_B C_A,in2 - F_out C_A ] / V  -  k(T) C_A'),
      space(),
      bodyJust('where V = A_tank \u00d7 H is the instantaneous reactor volume.'),

      heading3('3.2.3  Mass Balance on Product B'),
      bodyJust('Product B is generated by the reaction and removed by the outlet flow:'),
      space(80),
      equationBox('dC_B/dt = [ -F_out C_B ] / V  +  k(T) C_A'),
      space(),
      bodyJust('Since neither inlet stream contains product B (C_B,in = 0), no convective B enters the reactor.'),

      heading3('3.2.4  Arrhenius Reaction Rate'),
      bodyJust('The reaction rate constant k depends exponentially on temperature, following the Arrhenius equation:'),
      space(80),
      equationBox('k(T) = k\u2080 \u00d7 exp( -E_a/(R \u00d7 T) )'),
      space(),
      bodyJust('where k\u2080 = 1.85 \u00d7 10\u2077 h\u207b\u00b9 and E_a/R = 2352.61 K are the PSO-calibrated kinetic parameters from the MLAPC laboratory CSTR. T(t) is now a physically-modelled state variable (see 3.2.6), not a manipulated input.'),

      heading3('3.2.5  Numerical Integration'),
      bodyJust('The ODEs are integrated at each timestep using a sub-stepped Euler scheme (4 sub-steps per timestep dt = 0.02 h) for numerical stability. This gives 200 integration steps per 4-hour episode.'),

      heading3('3.2.6  Energy Balance (Hot Oil Bath Extension)'),
      bodyJust('The new energy balance on the reactor liquid couples three distinct thermal contributions: convective enthalpy carried by the two feed streams, exothermic reaction heat released by the A \u2192 B conversion, and jacket heat transfer from the hot oil bath:'),
      space(80),
      equationBox('dT/dt = [ F_A (T_A_in - T) + F_B (T_B_in - T) ] / V'),
      space(20),
      equationBox('       + (-\u0394H_rxn) \u00b7 k(T) \u00b7 C_A / (\u03c1 \u00b7 C_p)'),
      space(20),
      equationBox('       + UA \u00b7 (T_oil - T) / (\u03c1 \u00b7 V \u00b7 C_p)'),
      space(),
      bodyJust('The first term is the difference between enthalpy in (F\u00b7T_in) and enthalpy out (F\u00b7T) for each feed, expressed as a lumped convective contribution. The second term (reaction heat) is positive for exothermic chemistry (\u0394H_rxn < 0). The third term (jacket heat) is positive when T_oil > T and negative otherwise, providing the principal control authority over reactor temperature.'),
      space(),
      makeTable(
        ['Parameter', 'Symbol', 'Value', 'Physical meaning'],
        [
          ['Density', '\u03c1', '1000 kg/m\u00b3', 'Liquid density (water-like)'],
          ['Specific heat', 'C_p', '4.18 kJ/(kg\u00b7K)', 'Liquid heat capacity'],
          ['Heat of reaction', '\u0394H_rxn', '-5 \u00d7 10\u2074 kJ/kmol', 'Exothermic (negative)'],
          ['Jacket heat-transfer term', 'UA', '2000 kJ/(h\u00b7K)', 'Product of U and heat-exchange area'],
        ],
        [2400, 1500, 2500, 2960]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 2 \u2014 Energy-Balance Parameters', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.3  Parameter Estimation via PSO'),
      bodyJust('The kinetic parameters k\u2080 and E_a/R were estimated using Particle Swarm Optimisation (PSO) fitted against experimental temperature data from the MLAPC laboratory CSTR. The PSO minimised the Root Mean Square Error between model-predicted and measured reactor temperatures.'),
      space(),
      makeTable(
        ['Parameter', 'Symbol', 'Optimised Value', 'Units'],
        [
          ['Pre-exponential factor', 'k\u2080', '1.85 \u00d7 10\u2077', 'h\u207b\u00b9'],
          ['Activation energy / R', 'E_a/R', '2352.61', 'K'],
          ['Model fit (R\u00b2)', '\u2014', '0.9474', '\u2014'],
          ['RMSE (temperature)', '\u2014', '1.2771', '\u00b0C'],
        ],
        [2500, 1800, 2000, 1060]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 3 \u2014 PSO-Calibrated Kinetic Parameters (R\u00b2 = 0.9474)', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.4  Reinforcement Learning Framework'),
      bodyJust('Reinforcement learning (RL) is a machine learning paradigm in which an agent learns to interact with an environment by trial and error to maximise cumulative reward. At each timestep t, the agent observes state s_t, selects action a_t, receives reward r_t+1, and transitions to state s_t+1.'),
      space(),

      heading3('3.4.1  Value Function and Bellman Equation'),
      bodyJust('The goal of the agent is to find a policy \u03c0 that maximises the expected discounted return. The state-value function is:'),
      space(80),
      equationBox('v_\u03c0(s) = E{ R_{t+1} + \u03b3 R_{t+2} + \u03b3\u00b2 R_{t+3} + \u2026 | S_t = s }'),
      space(),
      bodyJust('where \u03b3 \u2208 [0,1] is the discount factor (set to 0.99) that prioritises near-term rewards. The optimal value function satisfies Bellman\'s optimality equation:'),
      space(80),
      equationBox('v*(s) = max_a \u03a3_{s\',r} p(s\',r|s,a) [ r + \u03b3 v*(s\') ]'),
      space(),
      bodyJust('where p(s\', r | s, a) is the state-transition probability. In a deterministic simulator (our CSTR), transitions are deterministic and the sum collapses to a single next state.'),

      heading3('3.4.2  State Space Definition'),
      bodyJust('The environment state is a 13-dimensional vector that combines reactor measurements, PID-like error signals on reactor temperature, and a 5-bit scenario mask informing the agent which manipulated variables are currently active:'),
      space(80),
      equationBox('s_t = [ T/T_ref,  e_T,  \u222b e_T dt,  d e_T/dt,  sp_T/T_ref,'),
      space(20),
      equationBox('        H/H_max,  C_A,  C_B,  mask[0..4] ]'),
      space(),
      bodyJust('where e_T = sp_T - T is the signed reactor-temperature tracking error, mask \u2208 {0,1}\u2075 identifies which MVs are controllable in the current scenario (1 = active, 0 = frozen at a physical default). All normalisation constants are chosen so that each component is approximately in [-1, 1] for stable neural-network training.'),

      heading3('3.4.3  Action Space'),
      bodyJust('The action space is 5-dimensional and continuous. The Actor network outputs a vector in [-1, 1]\u2075 via a Tanh activation; each component is then linearly scaled to its physical range:'),
      space(80),
      equationBox('a_t = [ a_{T_A_in}, a_{T_B_in}, a_{F_A}, a_{F_B}, a_{T_oil} ]  \u2208  [-1, 1]\u2075'),
      space(),
      makeTable(
        ['Index', 'MV', 'Physical range'],
        [
          ['0', 'T_A_in', '15 \u2013 80 \u00b0C (288.15 \u2013 353.15 K)'],
          ['1', 'T_B_in', '15 \u2013 80 \u00b0C (288.15 \u2013 353.15 K)'],
          ['2', 'F_A',   '0 \u2013 2.0 m\u00b3/h'],
          ['3', 'F_B',   '0 \u2013 2.0 m\u00b3/h'],
          ['4', 'T_oil', '30 \u2013 120 \u00b0C (303.15 \u2013 393.15 K)'],
        ],
        [1400, 2300, 5660]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 4 \u2014 Manipulated-Variable Definitions and Ranges', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),
      bodyJust('MVs whose mask bit is 0 in the active scenario are overridden at the environment boundary to their sensible physical defaults (T_feed = 25 \u00b0C, F = 0.5 m\u00b3/h, T_oil = 60 \u00b0C) before integration. The agent still outputs all 5 actions, but only the 2 active components affect the reactor.'),

      heading3('3.4.4  Reward Function'),
      bodyJust('The agent receives a reward at each timestep that is the negative squared reactor-temperature error. Level and compositions are not rewarded (level is kept safe by the internal controller). This simple, focused signal drives the agent to track the setpoint trajectory closely across all seven scenarios:'),
      space(80),
      equationBox('r_t = - w_T \u00d7 e_T\u00b2     with  w_T = 100'),
      space(),

      heading3('3.4.5  Scenario Sampling'),
      bodyJust('At the start of each training episode, one of the following seven scenarios is sampled uniformly at random. The corresponding mask is applied to the action at every step of the episode, and the scenario mask is included in the observed state so the agent can condition its policy on the active MV pair.'),
      space(),
      makeTable(
        ['#', 'Active MV 1', 'Active MV 2', 'Mask (T_A_in, T_B_in, F_A, F_B, T_oil)'],
        [
          ['1', 'T_A_in', 'T_B_in', '[1, 1, 0, 0, 0]'],
          ['2', 'T_oil',  'F_A',    '[0, 0, 1, 0, 1]'],
          ['3', 'T_oil',  'F_B',    '[0, 0, 0, 1, 1]'],
          ['4', 'T_A_in', 'F_B',    '[1, 0, 0, 1, 0]'],
          ['5', 'T_B_in', 'F_A',    '[0, 1, 1, 0, 0]'],
          ['6', 'T_oil',  'T_A_in', '[1, 0, 0, 0, 1]'],
          ['7', 'T_oil',  'T_B_in', '[0, 1, 0, 0, 1]'],
        ],
        [500, 1800, 1800, 5260]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 5 \u2014 Seven MV-Pairing Scenarios', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.5  TD3 Algorithm'),
      bodyJust('The reinforcement learning algorithm selected for this project is Twin Delayed Deep Deterministic Policy Gradient (TD3), introduced by Fujimoto et al. (2018). TD3 is specifically designed for environments with continuous action spaces \u2014 such as the CSTR, where the five manipulated variables are real-valued quantities. TD3 improves on DDPG through three targeted mechanisms:'),
      space(60),
      bullet('Twin Critics (Clipped Double Q-Learning): Two independent critic networks Q\u2081 and Q\u2082 are trained simultaneously. The target Q-value uses the minimum of both, preventing overestimation bias that otherwise causes the actor to exploit artificially inflated Q-values.'),
      bullet('Delayed Policy Updates: The actor is updated only every 2 critic updates, allowing the value estimate to stabilise before the policy changes.'),
      bullet('Target Policy Smoothing: Gaussian noise is added to the target actions during critic training, regularising the Q-function and preventing it from fitting sharp, narrow peaks in action space.'),
      space(60),

      heading3('3.5.1  Critic (Q-Function) Update'),
      equationBox('a\' = clip( \u03bc_\u03b8\'(s\') + clip(\u03b5, -c, c),  -1, 1 )     \u03b5 ~ N(0, \u03c3\u00b2)'),
      space(60),
      equationBox('y  =  r  +  \u03b3 (1 - d) min[ Q\u2081_\u03c8\'(s\', a\'),  Q\u2082_\u03c8\'(s\', a\') ]'),
      space(60),
      equationBox('L(\u03c8)  =  MSE( Q\u2081_\u03c8(s, a), y )  +  MSE( Q\u2082_\u03c8(s, a), y )'),
      space(),

      heading3('3.5.2  Actor (Policy) Update (every 2 critic steps)'),
      equationBox('\u2207_\u03b8 J(\u03b8)  =  E[ \u2207_a Q\u2081_\u03c8(s, a) |_{a=\u03bc_\u03b8(s)}  \u00d7  \u2207_\u03b8 \u03bc_\u03b8(s) ]'),
      space(),

      heading3('3.5.3  Target Network Soft Update (Polyak Averaging)'),
      equationBox('\u03b8\'  \u2190  \u03c4 \u03b8  +  (1 - \u03c4) \u03b8\''),
      space(),
      bodyJust('with \u03c4 = 0.003, providing stable training targets while slowly tracking the learned networks.'),

      heading3('3.5.4  Ornstein-Uhlenbeck Exploration Noise'),
      equationBox('dx_t  =  \u03b8 (\u03bc - x_t) dt  +  \u03c3 \u221adt \u00d7 N(0, 1)'),
      space(),
      bodyJust('with \u03bc = 0, \u03b8 = 0.15, \u03c3 = 0.2. Temporally correlated noise produces smoother, more physically realistic exploration than i.i.d. Gaussian noise.'),

      heading2('3.6  Neural Network Architecture'),
      bodyJust('The network architectures scale directly with the new 13-D state and 5-D action dimensions:'),
      space(80),
      makeTable(
        ['Component', 'Input Dim', 'Layer 1', 'Layer 2', 'Output', 'Activation'],
        [
          ['Actor (\u03bc_\u03b8)',    '13',      '400 units', '200 units', '5 actions',  'ReLU / Tanh'],
          ['Critic Q\u2081 (\u03c8\u2081)', '18 (s+a)', '800 units', '400 units', '1 Q-value',  'ReLU / Linear'],
          ['Critic Q\u2082 (\u03c8\u2082)', '18 (s+a)', '800 units', '400 units', '1 Q-value',  'ReLU / Linear'],
        ],
        [1800, 1100, 1100, 1100, 1300, 1360]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 6 \u2014 Neural Network Architecture (5-MV Extended Model)', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.7  Training Hyperparameters'),
      makeTable(
        ['Hyperparameter', 'Value', 'Description'],
        [
          ['Batch size', '64', 'Transitions sampled per update'],
          ['Replay buffer size', '10\u2076', 'Circular buffer; oldest replaced'],
          ['Learning rate (\u03b1)', '3 \u00d7 10\u207b\u2074', 'Adam optimiser, actor & critics'],
          ['Discount factor (\u03b3)', '0.99', 'Long-term reward weighting'],
          ['Target update rate (\u03c4)', '0.003', 'Polyak averaging coefficient'],
          ['Exploration noise (\u03c3)', '0.2', 'OU process noise magnitude'],
          ['Policy delay', '2', 'Actor updated every 2 critic steps'],
          ['Target noise', '0.2', 'Action smoothing noise std dev'],
          ['Target noise clip', '0.5', 'Clipping range for target noise'],
          ['Warmup steps', '1,000', 'Random actions before training'],
          ['Episodes', '10,000', 'Universal agent across 7 scenarios'],
          ['Steps per episode', '200', '4 simulated hours at dt = 0.02 h'],
        ],
        [2800, 1500, 5060]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 7 \u2014 TD3 Hyperparameters (5-MV Extended Model)', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      // ── 4. SIMULATION ────────────────────────────────────────────────────────
      heading1('4.  Simulation'),

      heading2('4.1  Software Implementation'),
      bodyJust('The simulation was implemented entirely in Python 3.13 using PyTorch 2.11 for neural network training and NumPy for numerical computation. The project is structured into the following modular files:'),
      space(60),
      bullet('cstr_env.py \u2014 CSTR first-principles environment with energy balance, 7-scenario sampling, 13-D state, 5-D action'),
      bullet('td3_agent.py \u2014 TD3 algorithm: Actor, Critic, OUNoise, ReplayBuffer, TD3Agent'),
      bullet('train.py \u2014 Training loop: 10,000 episodes, checkpointing, logging'),
      bullet('validate.py \u2014 Runs each of the 7 scenarios under a scripted stepped setpoint profile and saves per-scenario + summary figures'),
      bullet('dashboard.py \u2014 Interactive Streamlit dashboard with scenario selector and temperature setpoint control'),
      space(),

      heading2('4.2  CSTR Environment Code'),
      heading3('4.2.1  Environment Initialisation'),
      codeBlock([
        'class CSTREnv:',
        '    def __init__(self, max_steps=200, dt=0.02):',
        '        # --- geometry & hydraulics ---',
        '        self.A_tank = 1.0     # m^2',
        '        self.cv     = 0.8     # m^2.5/h',
        '        self.H_max  = 3.0     # m',
        '        # --- feed compositions ---',
        '        self.CA_in1 = 1.0     # kmol/m^3 (Feed A)',
        '        self.CA_in2 = 0.5     # kmol/m^3 (Feed B)',
        '        # --- kinetics (PSO) ---',
        '        self.k0     = 1.85e7  # h^-1',
        '        self.Ea_R   = 2352.61 # K',
        '        # --- thermal ---',
        '        self.rho    = 1000.0  # kg/m^3',
        '        self.Cp     = 4.18    # kJ/(kg.K)',
        '        self.dH_rxn = -5.0e4  # kJ/kmol (exothermic)',
        '        self.UA     = 2000.0  # kJ/(h.K)',
        '        # --- manipulated-variable bounds ---',
        '        self.mv_min     = [288.15, 288.15, 0.0, 0.0, 303.15]',
        '        self.mv_max     = [353.15, 353.15, 2.0, 2.0, 393.15]',
        '        self.mv_default = [298.15, 298.15, 0.5, 0.5, 333.15]',
        '        self.state_dim  = 13   # 8 process states + 5 scenario mask bits',
        '        self.action_dim = 5',
      ]),
      space(),

      heading3('4.2.2  Energy-Balance Integration'),
      codeBlock([
        '    def _integrate_step(self, H, CA, CB, T, mv):',
        '        T_A_in, T_B_in, F_A, F_B, T_oil = mv',
        '        k = self.k0 * np.exp(-self.Ea_R / T)',
        '        sub_dt = self.dt / 4.0',
        '        for _ in range(4):',
        '            V  = self.A_tank * max(H, 0.01)',
        '            F_out = self.cv * np.sqrt(max(H, 0.0))',
        '            # volume + mass balances',
        '            dH  = (F_A + F_B - F_out) / self.A_tank',
        '            dCA = (F_A*self.CA_in1 + F_B*self.CA_in2 - F_out*CA)/V - k*CA',
        '            dCB = (-F_out * CB) / V + k * CA',
        '            # energy balance (hot-oil-bath jacket)',
        '            conv   = (F_A*(T_A_in - T) + F_B*(T_B_in - T)) / V',
        '            rxn    = (-self.dH_rxn) * k * CA / (self.rho * self.Cp)',
        '            jacket = self.UA * (T_oil - T) / (self.rho * V * self.Cp)',
        '            dT     = conv + rxn + jacket',
        '            H  += sub_dt * dH',
        '            CA = max(CA + sub_dt * dCA, 0.0)',
        '            CB = max(CB + sub_dt * dCB, 0.0)',
        '            T  += sub_dt * dT',
        '        return H, CA, CB, T',
      ]),
      space(),

      heading2('4.3  TD3 Agent Code'),
      heading3('4.3.1  Actor Network'),
      codeBlock([
        'class Actor(nn.Module):',
        '    """Policy: state -> action  [13 -> 400 -> 200 -> 5]"""',
        '    def __init__(self, state_dim=13, action_dim=5):',
        '        super().__init__()',
        '        self.net = nn.Sequential(',
        '            nn.Linear(state_dim, 400), nn.ReLU(),',
        '            nn.Linear(400, 200),        nn.ReLU(),',
        '            nn.Linear(200, action_dim), nn.Tanh()  # output in [-1,1]',
        '        )',
      ]),
      space(),

      heading3('4.3.2  Critic Network'),
      codeBlock([
        'class Critic(nn.Module):',
        '    """Q-value: (state, action) -> Q  [(13+5) -> 800 -> 400 -> 1]"""',
        '    def __init__(self, state_dim=13, action_dim=5):',
        '        super().__init__()',
        '        self.net = nn.Sequential(',
        '            nn.Linear(state_dim + action_dim, 800), nn.ReLU(),',
        '            nn.Linear(800, 400),                    nn.ReLU(),',
        '            nn.Linear(400, 1)',
        '        )',
      ]),
      space(),

      heading2('4.4  Training Procedure'),
      bodyJust('Training was conducted on an NVIDIA RTX 4060 GPU over 10,000 episodes, each comprising 200 environment steps (4 simulated hours at dt = 0.02 h). A fresh scenario (1\u20137) and a fresh random stepped-setpoint profile in the range 25 \u2013 50 \u00b0C are sampled at the start of each episode, so the universal agent sees all seven MV pairings many thousands of times during training.'),
      space(),
      codeBlock([
        '# Core training loop (train.py)',
        'for episode in range(1, num_episodes + 1):',
        '    state = env.reset()          # samples scenario & setpoint profile',
        '    agent.noise.reset()',
        '    for step in range(max_steps):',
        '        action = agent.select_action(state, explore=True)',
        '        next_state, reward, done, _ = env.step(action)',
        '        agent.store_transition(state, action, reward, next_state, done)',
        '        agent.train_step()       # critic every step, actor every 2',
        '        state = next_state',
        '        if done: break',
      ]),

      // ── 5. RESULTS ───────────────────────────────────────────────────────────
      heading1('5.  Simulation Results'),

      heading2('5.1  Training Performance Summary'),
      makeTable(
        ['Metric', 'Value'],
        [
          ['Total training episodes', '10,000'],
          ['Steps per episode', '200 (4 simulated hours)'],
          ['Total environment steps', '2,000,000'],
          ['Scenario sampling', 'Uniform over 7 MV pairings'],
          ['Device', 'NVIDIA RTX 4060 (CUDA)'],
          ['Model checkpoint', 'checkpoints/best/'],
        ],
        [5000, 4360]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 8 \u2014 Training Performance Summary', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('5.2  Learning Curve'),
      bodyJust('The learning curve plots cumulative episode reward versus episode number over the full 10,000-episode training run. The smoothed curve (200-episode moving average) is overlaid on the faint raw per-episode rewards. Because the reward is the negative squared temperature error integrated over 200 steps (reward = -100 \u00b7 \u03a3 e_T\u00b2), values become less negative as tracking improves, with 0 representing perfect tracking.'),
      space(),
      ...figure(imgLC, 'png', 580, 320, 'Figure 1 \u2014 Learning Curve: Cumulative Episode Reward vs Episode (10,000 Episodes)'),

      heading2('5.3  Seven MV-Pairing Scenarios \u2014 Validation'),
      bodyJust('Each of the seven scenarios was simulated for 4 hours using the best trained checkpoint, with the scripted stepped setpoint profile:'),
      space(60),
      equationBox('sp_T(t):  32 \u00b0C  \u2192  40 \u00b0C  \u2192  45 \u00b0C  \u2192  36 \u00b0C  \u2192  42 \u00b0C  (every 0.8 h)'),
      space(),
      bodyJust('Each figure below is a two-panel plot: the top panel shows the reactor temperature tracking the stepped setpoint, and the bottom panel shows the two manipulated variables that are active in that scenario.'),
      space(),

      // Seven scenario subsections
      ...SCENARIO_NAMES.flatMap((n, i) => {
        const captions = [
          'Figure ' + (i+2) + ' \u2014 Scenario ' + (i+1) + ': ' + SCENARIO_LABELS[i] + ' (top) reactor T tracking; (bottom) active MVs',
        ];
        return [
          heading3('5.3.' + (i+1) + '  Scenario ' + (i+1) + ': ' + SCENARIO_LABELS[i]),
          ...figure(scenarioImgs[i], 'png', 620, 380, captions[0]),
        ];
      }),

      heading2('5.4  Seven-Scenario Summary Panel'),
      bodyJust('A composite figure showing all seven scenarios at once for direct side-by-side comparison of tracking performance.'),
      space(),
      ...figure(imgAll, 'png', 640, 400, 'Figure 9 \u2014 Summary: Reactor Temperature Tracking Across All Seven MV-Pairing Scenarios'),

      // ── 6. CONCLUSION ────────────────────────────────────────────────────────
      heading1('6.  Conclusion'),
      bodyJust('This project successfully extended the Deep Reinforcement Learning CSTR controller of Martinez et al. (PSE 2021+) with a physically modelled hot-oil-bath heating jacket, a full energy balance, and five manipulated variables grouped into seven practical MV-pairing scenarios. The following conclusions are drawn:'),
      space(80),
      bullet('A single universal TD3 agent with a 13-D state vector (including a 5-bit scenario mask) and a 5-D continuous action space is able to learn effective reactor-temperature control across all seven MV-pairing scenarios, without retraining per scenario.'),
      bullet('The newly introduced energy balance, combining convective feed enthalpy, exothermic reaction heat, and jacket heat transfer from the hot oil bath, makes reactor temperature a physically-modelled state variable rather than a direct manipulated input. This substantially improves the realism of the controlled plant.'),
      bullet('The internal level safety controller ensures the agent is never penalised by nor rewarded for level regulation. Because the reward depends only on reactor-temperature tracking, the agent develops specialised strategies per MV pair (e.g., using T_oil as primary thermal actuator, or using F_A/F_B to modulate convective enthalpy when the oil bath is frozen).'),
      bullet('PSO-calibrated kinetic parameters (k\u2080, E_a/R) from real laboratory CSTR data are successfully integrated into the extended simulation environment, ensuring physically meaningful dynamics. The PSO model achieved R\u00b2 = 0.9474 and RMSE = 1.28 \u00b0C.'),
      bullet('The Streamlit dashboard exposes the full 7-scenario library behind a single scenario dropdown, enabling immediate visual comparison of control behaviour across MV pairings \u2014 a valuable didactic tool for process-control training.'),
      space(),

      // ── REFERENCES ───────────────────────────────────────────────────────────
      heading1('References'),
      para([run('[1] ', { bold: true }), run('Martinez, B., Rodriguez, M., & Diaz, I. (2022). CSTR control with deep reinforcement learning. '), run('Proceedings of the 14th International Symposium on Process Systems Engineering (PSE 2021+)', { italics: true }), run(', Kyoto, Japan. DOI: 10.1016/B978-0-323-85159-6.50282-7')]),
      space(60),
      para([run('[2] ', { bold: true }), run('Fujimoto, S., van Hoof, H., & Meger, D. (2018). Addressing Function Approximation Error in Actor-Critic Methods. '), run('Proceedings of the 35th International Conference on Machine Learning (ICML 2018)', { italics: true }), run('.')]),
      space(60),
      para([run('[3] ', { bold: true }), run('Sutton, R.S. & Barto, A.G. (2018). '), run('Reinforcement Learning: An Introduction (2nd ed.)', { italics: true }), run('. MIT Press.')]),
      space(60),
      para([run('[4] ', { bold: true }), run('Shin, J., Badgwell, T.A., Liu, K. & Lee, J.H. (2019). Reinforcement Learning \u2013 Overview of recent progress and implications for process control. '), run('Computers and Chemical Engineering', { italics: true }), run(', 127, 282\u2013294.')]),
      space(60),
      para([run('[5] ', { bold: true }), run('PSO Parameter Estimation \u2014 MLAPC Lab CSTR. '), run('PSO_CSTR_MLAPClab.docx', { italics: true }), run('. UICPS FISAC Internal Report, 2026.')]),
      space(60),
      para([run('[6] ', { bold: true }), run('Spinning Up in Deep RL (2021). OpenAI. Retrieved from '), new ExternalHyperlink({ children: [new TextRun({ text: 'https://spinningup.openai.com', style: 'Hyperlink', size: 22, font: 'Arial' })], link: 'https://spinningup.openai.com' })]),
    ]
  }]
});

// ── Write file ─────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  const out = path.join(PROJ, 'UICPS FISAC report.docx');
  fs.writeFileSync(out, buffer);
  console.log('Report written to:', out);
});
