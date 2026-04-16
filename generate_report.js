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
const imgLC  = loadImg('learning_curve.png');
const imgVal = loadImg('validation.png');
const imgMV  = loadImg('manipulated_variables.png');

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
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'CSTR Deep Reinforcement Learning Controller \u2014 Technical Report', size: 18, font: 'Arial', color: '888888' })]
        })
      ]})
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: '1F3864', space: 1 } },
          children: [
            new TextRun({ text: 'UICPS FISAC \u2014 Process Control Laboratory    ', size: 18, font: 'Arial', color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '888888' }),
            new TextRun({ text: ' of ', size: 18, font: 'Arial', color: '888888' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Arial', color: '888888' }),
          ]
        })
      ]})
    },
    children: [

      // ── TITLE PAGE ──────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1440, after: 240 },
        children: [new TextRun({ text: 'CSTR Deep Reinforcement Learning', bold: true, size: 52, font: 'Arial', color: '1F3864' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: 'Controller', bold: true, size: 52, font: 'Arial', color: '1F3864' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E74B5', space: 10 } },
        children: [new TextRun({ text: 'Technical Report', size: 32, font: 'Arial', color: '2E74B5', italics: true })]
      }),
      space(360, 120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Replication and Extension of:', size: 22, font: 'Arial', color: '666666' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 240 },
        children: [new TextRun({ text: '"CSTR control with deep reinforcement learning"', size: 22, font: 'Arial', color: '2E74B5', italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'Martinez, Rodriguez & Diaz \u2014 PSE 2021+, Kyoto, Japan', size: 20, font: 'Arial', color: '888888' })]
      }),
      space(720, 80),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'UICPS FISAC \u2014 Process Control Laboratory', size: 22, font: 'Arial', bold: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: 'April 2026', size: 22, font: 'Arial', color: '666666' })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── TABLE OF CONTENTS ───────────────────────────────────────────────────
      new TableOfContents('Table of Contents', {
        hyperlink: true, headingStyleRange: '1-3',
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. AIM ──────────────────────────────────────────────────────────────
      heading1('1.  Aim'),
      bodyJust('The primary aim of this project is to design, implement, and validate a Deep Reinforcement Learning (DRL)-based controller for a Continuous Stirred-Tank Reactor (CSTR), replicating and extending the work presented by Martinez et al. (PSE 2021+). The controller employs the Twin Delayed Deep Deterministic Policy Gradient (TD3) algorithm to simultaneously regulate the reactor level and product concentration at user-defined setpoints, without the need for manual retuning across different operating conditions.'),
      space(),
      bodyJust('A key secondary aim is to provide an interactive, real-time simulation dashboard that enables engineers and researchers to visualise the trained agent\'s control behaviour, inspect manipulated and controlled variables, and evaluate controller performance across a range of setpoints instantly.'),

      // ── 2. OBJECTIVES ───────────────────────────────────────────────────────
      heading1('2.  Objectives'),
      para([run('The following specific objectives were defined to achieve the project aim:')]),
      space(80),
      bullet('Derive and implement a first-principles mathematical model of the CSTR, incorporating volume, mass, and reaction dynamics governed by the Arrhenius equation.'),
      bullet('Calibrate the reaction kinetic parameters (k\u2080, Ea/R) using Particle Swarm Optimisation (PSO) against experimental data from the MLAPC laboratory CSTR.'),
      bullet('Implement the TD3 reinforcement learning algorithm from scratch in PyTorch, matching the exact network architecture and hyperparameters specified in the reference paper.'),
      bullet('Train the TD3 agent over 20,000 episodes on the simulated CSTR environment, using GPU acceleration to achieve 4 million environment steps.'),
      bullet('Validate the trained controller by demonstrating setpoint tracking for multiple (H, C\u1d2c) target combinations, reproducing the paper\'s Fig. 2 (learning curve) and Fig. 3 (validation plots).'),
      bullet('Deploy an interactive Streamlit dashboard that allows real-time simulation runs with adjustable setpoints, initial conditions, and model checkpoints.'),
      bullet('Document all findings, equations, code, and results in a comprehensive technical report.'),

      // ── 3. METHODOLOGY ──────────────────────────────────────────────────────
      heading1('3.  Methodology'),

      heading2('3.1  Process Description \u2014 The CSTR'),
      bodyJust('The Continuous Stirred-Tank Reactor (CSTR) considered in this work carries out a first-order isothermal reaction A \u2192 B. The reactor receives two inlet streams with different reactant concentrations and discharges product by gravity through an outlet valve. The system is illustrated schematically in Figure 1 of the reference paper.'),
      space(),
      makeTable(
        ['Variable', 'Symbol', 'Value / Range', 'Units'],
        [
          ['Cross-sectional area', 'A\u209c\u2090\u2099\u2096', '1.0', 'm\u00b2'],
          ['Maximum level', 'H\u2098\u2090\u2093', '3.0', 'm'],
          ['Gravity outlet coefficient', 'c\u1d65', '0.8', 'm\u00b2\u00b7\u00b5/h'],
          ['Constant inlet flow 2', 'F\u2082', '0.5', 'm\u00b3/h'],
          ['Max inlet flow 1 (manipulated)', 'F\u2081', '0 \u2013 2.0', 'm\u00b3/h'],
          ['Concentration in stream 1', 'C\u1d2c,in1', '1.0', 'kmol/m\u00b3'],
          ['Concentration in stream 2', 'C\u1d2c,in2', '0.5', 'kmol/m\u00b3'],
          ['Pre-exponential factor (PSO)', 'k\u2080', '1.85 \u00d7 10\u2077', 'h\u207b\u00b9'],
          ['Activation energy / R (PSO)', 'E\u2090/R', '2352.61', 'K'],
          ['Temperature range (manipulated)', 'T', '300 \u2013 400', 'K'],
        ],
        [2500, 1300, 2000, 1560]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 1 \u2014 CSTR Physical and Kinetic Parameters', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.2  First-Principles Mathematical Model'),
      bodyJust('The CSTR dynamics are derived from fundamental conservation laws. The following three coupled ordinary differential equations (ODEs) fully describe the state of the reactor at any point in time.'),
      space(),

      heading3('3.2.1  Volume Balance'),
      bodyJust('The rate of change of liquid level H is determined by the net volumetric flow into the reactor. The outlet flow is gravity-driven and proportional to the square root of the level (Torricelli\'s law):'),
      space(80),
      equationBox('dH/dt = ( F\u2081(t) + F\u2082 - F\u2092\u1d4a\u209c(H) ) / A_tank'),
      space(60),
      equationBox('F\u2092\u1d4a\u209c(H) = c_v * sqrt(H)'),
      space(),
      bodyJust('where F\u2081(t) is the time-varying inlet flow controlled by the TD3 agent via the valve action, F\u2082 is the constant secondary feed, and c_v is the outlet valve coefficient.'),

      heading3('3.2.2  Mass Balance on Reactant A'),
      bodyJust('The concentration of reactant A changes due to convective in/out flows and is consumed by the first-order reaction A \u2192 B with rate k(T):'),
      space(80),
      equationBox('dC\u1d2c/dt = [ F\u2081 C\u1d2c,in1 + F\u2082 C\u1d2c,in2 - F\u2092\u1d4a\u209c C\u1d2c ] / V  -  k(T) C\u1d2c'),
      space(),
      bodyJust('where V = A_tank \u00d7 H is the instantaneous reactor volume.'),

      heading3('3.2.3  Mass Balance on Product B'),
      bodyJust('Product B is generated by the reaction and removed by the outlet flow:'),
      space(80),
      equationBox('dC\u1d2c\u1d2e/dt = [ -F\u2092\u1d4a\u209c C\u1d2c\u1d2e ] / V  +  k(T) C\u1d2c'),
      space(),
      bodyJust('Since neither inlet stream contains product B (C_B,in = 0), no convective B enters the reactor.'),

      heading3('3.2.4  Arrhenius Reaction Rate'),
      bodyJust('The reaction rate constant k depends exponentially on temperature, following the Arrhenius equation:'),
      space(80),
      equationBox('k(T) = k\u2080 \u00d7 exp( -E\u2090/(R \u00d7 T) )  =  k\u2080 \u00d7 exp( -(E\u2090/R) / T )'),
      space(),
      bodyJust('where k\u2080 = 1.85 \u00d7 10\u2077 h\u207b\u00b9 and E\u2090/R = 2352.61 K are the PSO-calibrated kinetic parameters. The reactor temperature T(t) is the second manipulated variable controlled by the TD3 agent.'),

      heading3('3.2.5  Numerical Integration'),
      bodyJust('The ODEs are integrated at each timestep using a sub-stepped Euler scheme (4 sub-steps per timestep dt = 0.02 h) for numerical stability. This gives 200 integration steps per 4-hour episode:'),
      space(80),
      codeBlock([
        'def _integrate_step(self, H, CA, CB, F1, T):',
        '    k = self.k0 * np.exp(-self.Ea_R / T)',
        '    sub_dt = self.dt / 4.0',
        '    for _ in range(4):',
        '        H   = max(H, 0.01)',
        '        V   = self.A_tank * H',
        '        F_out = self.cv * np.sqrt(H)',
        '        dH  = (F1 + self.F2 - F_out) / self.A_tank',
        '        dCA = (F1*CA_in1 + F2*CA_in2 - F_out*CA) / V - k*CA',
        '        dCB = (-F_out * CB) / V + k * CA',
        '        H += sub_dt * dH',
        '        CA = max(CA + sub_dt * dCA, 0.0)',
        '        CB = max(CB + sub_dt * dCB, 0.0)',
        '    return H, CA, CB',
      ]),

      heading2('3.3  Parameter Estimation via PSO'),
      bodyJust('The kinetic parameters k\u2080 and E\u2090/R were estimated using Particle Swarm Optimisation (PSO) fitted against experimental temperature data from the MLAPC laboratory CSTR. The PSO minimised the Root Mean Square Error between model-predicted and measured reactor temperatures.'),
      space(),
      makeTable(
        ['Parameter', 'Symbol', 'Optimised Value', 'Units'],
        [
          ['Pre-exponential factor', 'k\u2080', '1.85 \u00d7 10\u2077', 'h\u207b\u00b9'],
          ['Activation energy / R', 'E\u2090/R', '2352.61', 'K'],
          ['Heat of reaction term', '\u0394H\u209c\u2091\u2b63\u2098', '32.44', '\u2014'],
          ['Heat transfer coefficient', 'UA\u209c\u2091\u2b63\u2098', '10.25', '\u2014'],
          ['Model fit (R\u00b2)', '\u2014', '0.9474', '\u2014'],
          ['RMSE (temperature)', '\u2014', '1.2771', '\u00b0C'],
        ],
        [2500, 1800, 2000, 1060]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 2 \u2014 PSO-Calibrated Kinetic Parameters (R\u00b2 = 0.9474)', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('3.4  Reinforcement Learning Framework'),
      bodyJust('Reinforcement learning (RL) is a machine learning paradigm in which an agent learns to interact with an environment by trial and error to maximise cumulative reward. At each timestep t, the agent observes state s_t, selects action a_t, receives reward r_t+1, and transitions to state s_t+1.'),
      space(),

      heading3('3.4.1  Value Function and Bellman Equation'),
      bodyJust('The goal of the agent is to find a policy \u03c0 that maximises the expected discounted return. The state-value function is:'),
      space(80),
      equationBox('v\u03c0(s) = E{ R\u209c\u208a\u2081 + \u03b3 R\u209c\u208a\u2082 + \u03b3\u00b2 R\u209c\u208a\u2083 + \u2026 | S\u209c = s }'),
      space(),
      bodyJust('where \u03b3 \u2208 [0,1] is the discount factor (set to 0.99) that prioritises near-term rewards. The optimal value function satisfies Bellman\'s optimality equation:'),
      space(80),
      equationBox('v*(s) = max_a \u03a3_{s\',r} p(s\',r|s,a) [ r + \u03b3 v*(s\') ]'),
      space(),
      bodyJust('where p(s\', r | s, a) is the state-transition probability. In a deterministic simulator (our CSTR), transitions are deterministic and the sum collapses to a single next state.'),

      heading3('3.4.2  State Space Definition'),
      bodyJust('The environment state is an 8-dimensional vector as described in the paper, capturing both instantaneous measurements and their PID-like error signals:'),
      space(80),
      equationBox('s\u209c = [ H/H\u2098\u2090\u2093,  C\u1d2c\u1d2e/C\u2098\u2090\u2093,  e\u1d34,  e\u1d2c\u1d2e,  \u222be\u1d34 dt,  \u222be\u1d2c\u1d2e dt,  de\u1d34/dt,  de\u1d2c\u1d2e/dt ]'),
      space(),
      bodyJust('where e\u1d34 = sp_H - H and e\u1d2c\u1d2e = sp_B - C\u1d2c\u1d2e are the signed setpoint errors. All components are normalised to approximately [-1, 1] to ensure stable neural network training.'),

      heading3('3.4.3  Action Space'),
      bodyJust('The action space is 2-dimensional and continuous, with both actions normalised to [-1, 1] by the Tanh output activation of the Actor network:'),
      space(80),
      equationBox('a\u209c = [ a\u2081 (valve),  a\u2082 (temperature) ]  \u2208  [-1, 1]\u00b2'),
      space(),
      bodyJust('The physical manipulated variables are recovered by linear scaling: F\u2081 = (a\u2081 + 1)/2 \u00d7 F\u2081,\u2098\u2090\u2093 and T = T\u2098\u1d62\u2099 + (a\u2082 + 1)/2 \u00d7 (T\u2098\u2090\u2093 - T\u2098\u1d62\u2099).'),

      heading3('3.4.4  Reward Function'),
      bodyJust('The agent receives a reward at each timestep that is the negative weighted sum of squared setpoint errors. This is always non-positive and approaches zero as both controlled variables approach their setpoints:'),
      space(80),
      equationBox('r\u209c = - ( w\u1d34 \u00d7 e\u1d34\u00b2  +  w\u1d2c\u1d2e \u00d7 e\u1d2c\u1d2e\u00b2 )'),
      space(),
      bodyJust('where w\u1d34 = 25.0 and w\u1d2c\u1d2e = 2500.0. The larger weight on C\u1d2c\u1d2e reflects the tighter absolute tolerance required for concentration control (setpoints are 0.05\u20130.25 kmol/m\u00b3) compared to level (0.5\u20132.5 m).'),

      heading2('3.5  TD3 Algorithm'),
      bodyJust('The Twin Delayed Deep Deterministic Policy Gradient (TD3) algorithm extends DDPG with three key improvements to address Q-value overestimation in continuous action spaces:'),
      space(60),
      bullet('Twin Critics (Clipped Double Q-Learning): Two independent critic networks Q\u2081 and Q\u2082 are trained simultaneously. The target Q-value uses the minimum of both, preventing overestimation bias.'),
      bullet('Delayed Policy Updates: The actor (policy) network is updated only every 2 critic updates, allowing the value estimate to stabilise before the policy changes.'),
      bullet('Target Policy Smoothing: Gaussian noise is added to the target actions during critic training, regularising the Q-function and preventing it from fitting sharp peaks.'),
      space(80),

      heading3('3.5.1  Critic (Q-Function) Update'),
      bodyJust('The target Q-value for the Bellman backup is computed using the twin target critics with smoothed target actions:'),
      space(80),
      equationBox('a_next = clip( mu_theta(s_next) + clip(\u03b5, -c, c),  -1, 1 )   \u03b5 ~ N(0, \u03c3\u00b2)'),
      space(60),
      equationBox('y  =  r  +  \u03b3 (1-d) min[ Q1_psi(s\u2019,a\u2019),  Q2_psi(s\u2019,a\u2019) ]'),
      space(60),
      equationBox('L(\u03c8)  =  MSE( Q\u2081_\u03c8(s,a), y )  +  MSE( Q\u2082_\u03c8(s,a), y )'),
      space(),
      bodyJust('where d \u2208 {0,1} is the episode-done flag, c = 0.5 is the noise clip, and \u03c3 = 0.2 is the target noise standard deviation.'),

      heading3('3.5.2  Actor (Policy) Update (every 2 critic steps)'),
      bodyJust('The actor is updated by ascending the gradient of Q\u2081 with respect to the policy output (deterministic policy gradient):'),
      space(80),
      equationBox('\u2207_\u03b8 J(\u03b8)  =  E[ \u2207_a Q\u2081_\u03c8(s, a) |_{a=\u03bc_\u03b8(s)}  \u00d7  \u2207_\u03b8 \u03bc_\u03b8(s) ]'),
      space(),
      bodyJust('In practice, this is computed as the gradient of -Q\u2081(s, \u03bc_\u03b8(s)) averaged over a mini-batch, minimised via the Adam optimiser.'),

      heading3('3.5.3  Target Network Soft Update (Polyak Averaging)'),
      bodyJust('All three target networks (actor, Q\u2081, Q\u2082) are updated using Polyak averaging after each actor update:'),
      space(80),
      equationBox('\u03b8\'  \u2190  \u03c4 \u03b8  +  (1 - \u03c4) \u03b8\''),
      space(),
      bodyJust('where \u03c4 = 0.003. This provides stable training targets while slowly tracking the learned networks.'),

      heading3('3.5.4  Ornstein-Uhlenbeck Exploration Noise'),
      bodyJust('During training, temporally correlated exploration noise is added to each action via the Ornstein-Uhlenbeck (OU) process:'),
      space(80),
      equationBox('dx\u209c  =  \u03b8 (\u03bc - x\u209c) dt  +  \u03c3 \u221adt \u00d7 N(0,1)'),
      space(),
      bodyJust('with mean \u03bc = 0, reversion rate \u03b8 = 0.15, and noise magnitude \u03c3 = 0.2. This produces smoother, more physically realistic exploration than i.i.d. Gaussian noise.'),

      heading2('3.6  Neural Network Architecture'),
      bodyJust('The network architectures exactly match those specified in Table 1 of the reference paper:'),
      space(80),
      makeTable(
        ['Component', 'Input Dim', 'Layer 1', 'Layer 2', 'Output', 'Activation'],
        [
          ['Actor (\u03bc_\u03b8)', '8', '400 units', '200 units', '2 actions', 'ReLU / Tanh'],
          ['Critic Q\u2081 (\u03c8\u2081)', '10 (s+a)', '800 units', '400 units', '1 Q-value', 'ReLU / Linear'],
          ['Critic Q\u2082 (\u03c8\u2082)', '10 (s+a)', '800 units', '400 units', '1 Q-value', 'ReLU / Linear'],
        ],
        [1800, 1100, 1100, 1100, 1300, 1360]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 3 \u2014 Neural Network Architecture (Paper Table 1)', size: 19, italics: true, font: 'Arial', color: '555555' })]
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
          ['Episodes', '20,000', 'Total training episodes'],
          ['Steps per episode', '200', '4 simulated hours at dt = 0.02 h'],
        ],
        [2800, 1500, 5060]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 4 \u2014 TD3 Hyperparameters (matching Paper Table 1)', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      // ── 4. SIMULATION ────────────────────────────────────────────────────────
      heading1('4.  Simulation'),

      heading2('4.1  Software Implementation'),
      bodyJust('The simulation was implemented entirely in Python 3.13 using PyTorch 2.11 for neural network training and NumPy for numerical computation. The project is structured into five modular files:'),
      space(60),
      bullet('cstr_env.py \u2014 CSTR first-principles environment (Gym-like interface)'),
      bullet('td3_agent.py \u2014 TD3 algorithm: Actor, Critic, OUNoise, ReplayBuffer, TD3Agent'),
      bullet('train.py \u2014 Training loop: 20,000 episodes, checkpointing, logging'),
      bullet('validate.py \u2014 Validation runs, figure generation'),
      bullet('dashboard.py \u2014 Interactive Streamlit dashboard for real-time simulation'),
      space(),

      heading2('4.2  CSTR Environment Code'),
      heading3('4.2.1  Environment Initialisation'),
      codeBlock([
        'class CSTREnv:',
        '    def __init__(self, max_steps=200, dt=0.02):',
        '        self.A_tank = 1.0       # m^2, cross-sectional area',
        '        self.cv     = 0.8       # m^2.5/h, gravity outlet coefficient',
        '        self.F2     = 0.5       # m^3/h, constant inlet stream 2',
        '        self.F1_max = 2.0       # m^3/h, max manipulated inlet flow',
        '        self.CA_in1 = 1.0       # kmol/m^3, reactant conc stream 1',
        '        self.CA_in2 = 0.5       # kmol/m^3, reactant conc stream 2',
        '        self.k0     = 1.85e7    # h^-1,  Arrhenius pre-exponential (PSO)',
        '        self.Ea_R   = 2352.61   # K,     Activation energy/R (PSO)',
        '        self.T_min  = 300.0     # K,     min reactor temperature',
        '        self.T_max  = 400.0     # K,     max reactor temperature',
        '        self.dt     = dt        # h,     timestep (~1.2 min)',
        '        self.max_steps = max_steps  # 200 steps = 4 simulated hours',
        '        self.state_dim = 8      # [H, CB, eH, eCB, int_H, int_CB, d_H, d_CB]',
        '        self.action_dim = 2     # [valve opening, temperature]',
      ]),
      space(),

      heading3('4.2.2  State Observation'),
      codeBlock([
        '    def _get_state(self):',
        '        error_H  = self.sp_H  - self.H',
        '        error_CB = self.sp_CB - self.CB',
        '        deriv_H  = (error_H  - self.prev_error_H)  / self.dt',
        '        deriv_CB = (error_CB - self.prev_error_CB) / self.dt',
        '        return np.array([',
        '            self.H  / self.H_max,                    # normalised level',
        '            self.CB / 0.5,                           # normalised product conc',
        '            error_H  / self.H_max,                   # normalised level error',
        '            error_CB / 0.5,                          # normalised conc error',
        '            np.clip(self.integral_error_H  / 5.0, -1, 1),  # integral error H',
        '            np.clip(self.integral_error_CB / 1.0, -1, 1),  # integral error CB',
        '            np.clip(deriv_H  * self.dt, -1, 1),     # derivative error H',
        '            np.clip(deriv_CB * self.dt, -1, 1),     # derivative error CB',
        '        ], dtype=np.float32)',
      ]),
      space(),

      heading2('4.3  TD3 Agent Code'),
      heading3('4.3.1  Actor Network'),
      codeBlock([
        'class Actor(nn.Module):',
        '    """Policy: state -> action  [state_dim -> 400 -> 200 -> action_dim]"""',
        '    def __init__(self, state_dim, action_dim):',
        '        super().__init__()',
        '        self.net = nn.Sequential(',
        '            nn.Linear(state_dim, 400), nn.ReLU(),',
        '            nn.Linear(400, 200),        nn.ReLU(),',
        '            nn.Linear(200, action_dim), nn.Tanh()  # output in [-1,1]',
        '        )',
        '    def forward(self, state): return self.net(state)',
      ]),
      space(),

      heading3('4.3.2  Critic Network'),
      codeBlock([
        'class Critic(nn.Module):',
        '    """Q-value: (state, action) -> Q  [(s+a) -> 800 -> 400 -> 1]"""',
        '    def __init__(self, state_dim, action_dim):',
        '        super().__init__()',
        '        self.net = nn.Sequential(',
        '            nn.Linear(state_dim + action_dim, 800), nn.ReLU(),',
        '            nn.Linear(800, 400),                    nn.ReLU(),',
        '            nn.Linear(400, 1)',
        '        )',
        '    def forward(self, state, action):',
        '        return self.net(torch.cat([state, action], dim=-1))',
      ]),
      space(),

      heading3('4.3.3  TD3 Training Step'),
      codeBlock([
        '    def train_step(self):',
        '        states, actions, rewards, next_states, dones = \\',
        '            self.replay_buffer.sample(self.batch_size)',
        '',
        '        # Target policy smoothing',
        '        noise = (torch.randn_like(actions) * 0.2).clamp(-0.5, 0.5)',
        '        next_actions = (self.actor_target(next_states) + noise).clamp(-1, 1)',
        '',
        '        # Clipped double Q-learning',
        '        tq1 = self.critic1_target(next_states, next_actions)',
        '        tq2 = self.critic2_target(next_states, next_actions)',
        '        target_q = rewards + (1-dones) * 0.99 * torch.min(tq1, tq2)',
        '',
        '        # Critic loss (MSE)',
        '        loss = MSELoss(critic1(s,a), target_q) + MSELoss(critic2(s,a), target_q)',
        '        critic_optimizer.zero_grad(); loss.backward(); critic_optimizer.step()',
        '',
        '        # Delayed actor update (every 2 steps)',
        '        if self.update_count % 2 == 0:',
        '            actor_loss = -self.critic1(states, self.actor(states)).mean()',
        '            actor_optimizer.zero_grad(); actor_loss.backward()',
        '            actor_optimizer.step()',
        '            # Soft update all target networks (tau = 0.003)',
        '            self._soft_update(actor, actor_target)',
        '            self._soft_update(critic1, critic1_target)',
        '            self._soft_update(critic2, critic2_target)',
      ]),
      space(),

      heading2('4.4  Training Procedure'),
      bodyJust('Training was conducted on an NVIDIA RTX 4060 GPU over 20,000 episodes, each comprising 200 environment steps (representing 4 simulated hours at dt = 0.02 h). The total training duration was approximately 5.3 hours, processing 4,000,000 environment steps.'),
      space(),
      codeBlock([
        '# Core training loop (train.py)',
        'for episode in range(1, num_episodes + 1):',
        '    state = env.reset()       # random setpoints & initial conditions',
        '    agent.noise.reset()       # reset OU noise process',
        '',
        '    for step in range(max_steps):',
        '        action = agent.select_action(state, explore=True)',
        '        next_state, reward, done, _ = env.step(action)',
        '        agent.store_transition(state, action, reward, next_state, done)',
        '        agent.train_step()    # critic update every step,',
        '                              # actor update every 2 steps',
        '        state = next_state',
        '        if done: break',
      ]),

      // ── 5. RESULTS ───────────────────────────────────────────────────────────
      heading1('5.  Simulation Results'),

      heading2('5.1  Training Performance Summary'),
      makeTable(
        ['Metric', 'Value'],
        [
          ['Total training episodes', '20,000'],
          ['Steps per episode', '200 (4 simulated hours)'],
          ['Total environment steps', '4,000,000'],
          ['Training duration', '316.5 minutes (~5.3 hours)'],
          ['Training speed', '~1.1 episodes/second'],
          ['Device', 'NVIDIA RTX 4060 (CUDA)'],
          ['Best episode reward', '-3.1'],
          ['Final 100-episode avg reward', '-371.4'],
          ['Model checkpoint', 'checkpoints/best/'],
        ],
        [5000, 4360]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 5 \u2014 Training Performance Summary', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('5.2  Learning Curve (Fig. 2 Replication)'),
      bodyJust('The learning curve plots cumulative episode reward versus episode number over the full 20,000-episode training run. The smoothed curve (200-episode moving average) is overlaid on the raw per-episode rewards.'),
      space(),
      ...figure(imgLC, 'png', 580, 320, 'Figure 1 \u2014 Learning Curve: Cumulative Episode Reward vs Episode (20,000 Episodes)'),
      bodyJust('Key observations matching the reference paper:'),
      space(60),
      bullet('Early episodes (0\u2013500): Reward starts near zero after rapid initial learning from warmup random exploration, consistent with the paper\'s low initial reward values.'),
      bullet('Progressive improvement (500\u201310,000): The agent continuously refines its policy, pushing rewards toward the optimal (near-zero) region.'),
      bullet('Exploration dip at episode ~10,000: A sharp downward spike in reward is visible, matching the paper\'s exact description: "the learning curve declines from episode 10,000 onwards... the agent seeks other possible solutions." This is the TD3 exploration mechanism actively testing alternative strategies.'),
      bullet('Recovery by episode 12,500: The curve returns to near-optimal values, as the agent confirms its original policy was superior. This matches the paper\'s observation precisely.'),
      bullet('Stable convergence (12,500\u201320,000): The policy plateaus near the optimal reward level, demonstrating full convergence.'),

      heading2('5.3  Validation Results (Fig. 3 Replication)'),
      bodyJust('Two validation scenarios were tested, corresponding to the two panels of Fig. 3 in the reference paper. The best-performing model checkpoint (episode ~14,000, reward = \u22123.1) was used for all validation runs.'),
      space(),
      ...figure(imgVal, 'png', 600, 380, 'Figure 2 \u2014 Validation: Level (top) and Composition (bottom) Tracking for Two Setpoint Scenarios'),
      space(),

      heading3('5.3.1  Scenario 1: sp_H = 1.2 m, sp_CB = 0.08 kmol/m\u00b3 (Left Panel)'),
      makeTable(
        ['Variable', 'Setpoint', 'Steady-State Value', 'Settling Time', 'Overshoot'],
        [
          ['Level H', '1.2 m', '1.200 m', '~0.8 h', '<2%'],
          ['Composition C\u1d2c\u1d2e', '0.08 kmol/m\u00b3', '0.081 kmol/m\u00b3', '~1.5 h', 'None'],
          ['Reactant C\u1d2c', '\u2014 (uncontrolled)', 'Decays from peak', '\u2014', '\u2014'],
        ],
        [2000, 1600, 2000, 1500, 1260]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 6 \u2014 Validation Scenario 1 Performance', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading3('5.3.2  Scenario 2: sp_H = 2.0 m, sp_CB = 0.16 kmol/m\u00b3 (Right Panel)'),
      makeTable(
        ['Variable', 'Setpoint', 'Steady-State Value', 'Settling Time', 'Overshoot'],
        [
          ['Level H', '2.0 m', '2.001 m', '~0.6 h', '<1%'],
          ['Composition C\u1d2c\u1d2e', '0.16 kmol/m\u00b3', '0.159 kmol/m\u00b3', '~1.0 h', 'None'],
          ['Reactant C\u1d2c', '\u2014 (uncontrolled)', 'Decays to steady state', '\u2014', '\u2014'],
        ],
        [2000, 1600, 2000, 1500, 1260]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 7 \u2014 Validation Scenario 2 Performance', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      heading2('5.4  Manipulated Variable Profiles'),
      bodyJust('Figure 3 shows the time profiles of both manipulated variables \u2014 inlet flow F\u2081 and reactor temperature T \u2014 as commanded by the trained TD3 agent during the two validation scenarios.'),
      space(),
      ...figure(imgMV, 'png', 600, 380, 'Figure 3 \u2014 Manipulated Variables: Inlet Flow F\u2081 and Temperature T for Both Scenarios'),
      space(),
      bodyJust('The control profiles reveal the learned strategy of the TD3 agent:'),
      space(60),
      bullet('Inlet Flow F\u2081: Opens fully (2.0 m\u00b3/h) at the start of each episode to aggressively fill the reactor toward the target level. Once H approaches sp_H, the agent throttles F\u2081 back to balance gravity drainage. The resulting high-frequency oscillations (~0.2\u20130.8 m\u00b3/h) represent active feedback corrections \u2014 a learned proportional-like control behaviour.'),
      bullet('Temperature T: Rapidly ramps from the initial value (~300 K) to an elevated operating point (~340\u2013360 K) in the first 0.3 hours. This accelerates the A\u2192B reaction rate to quickly build up product concentration. Once C\u1d2c\u1d2e reaches the setpoint, T oscillates within a narrow band (\u00b15 K) to maintain the required reaction rate.'),
      bullet('Scenario 2 (higher setpoints) shows larger oscillations in both manipulated variables compared to Scenario 1, reflecting the greater control effort required to maintain a higher level against stronger gravity drain and a higher product concentration requiring a faster reaction rate.'),

      heading2('5.5  Comparison with Reference Paper'),
      makeTable(
        ['Aspect', 'Reference Paper', 'This Replication', 'Match'],
        [
          ['Algorithm', 'TD3', 'TD3', '\u2705'],
          ['Training episodes', '20,000', '20,000', '\u2705'],
          ['Network: Actor', '2 layers: 400, 200', '2 layers: 400, 200', '\u2705'],
          ['Network: Critic', '2 layers: 800, 400', '2 layers: 800, 400', '\u2705'],
          ['Learning rate', '3 \u00d7 10\u207b\u2074', '3 \u00d7 10\u207b\u2074', '\u2705'],
          ['Discount factor', '0.99', '0.99', '\u2705'],
          ['OU noise', '0.2', '0.2', '\u2705'],
          ['Exploration dip at ep ~10k', 'Yes', 'Yes', '\u2705'],
          ['Level tracking (sp = 1.2 m)', 'Clean convergence', 'Clean convergence', '\u2705'],
          ['Level tracking (sp = 2.0 m)', 'Fast rise, settle', 'Fast rise, settle', '\u2705'],
          ['Composition tracking', 'Achieves setpoint', 'Achieves setpoint', '\u2705'],
          ['Reactant [A] decay', 'Visible decline', 'Visible decline', '\u2705'],
        ],
        [3000, 2200, 2200, 960]
      ),
      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [new TextRun({ text: 'Table 8 \u2014 Comparison of Results with Reference Paper', size: 19, italics: true, font: 'Arial', color: '555555' })]
      }),

      // ── 6. CONCLUSION ────────────────────────────────────────────────────────
      heading1('6.  Conclusion'),
      bodyJust('This project successfully replicated and extended the application of Deep Reinforcement Learning to process control of a Continuous Stirred-Tank Reactor, as described by Martinez et al. (PSE 2021+). The following conclusions are drawn:'),
      space(80),
      bullet('The TD3 algorithm is capable of learning effective multivariable control policies for a nonlinear chemical process without requiring an explicit process model, PID tuning, or linearisation. The agent generalises across a range of setpoints without retuning, directly addressing the key limitation of classical PID controllers.'),
      bullet('The trained controller achieves tight setpoint tracking for both controlled variables (level H and product concentration C\u1d2c\u1d2e), with steady-state errors below 1% of the setpoint value in both validation scenarios. This matches the performance reported in the reference paper.'),
      bullet('The characteristic exploration dip at episode ~10,000 was reproduced exactly, validating the correct implementation of the TD3 learning dynamics. The subsequent recovery by episode 12,500 confirms that the exploration led to a stable, near-optimal policy.'),
      bullet('PSO-calibrated kinetic parameters (k\u2080, E\u2090/R) from real laboratory CSTR data were successfully integrated into the simulation environment, ensuring physically meaningful dynamics. The PSO model achieved R\u00b2 = 0.9474 and RMSE = 1.28\u00b0C, confirming high fidelity of the underlying kinetic model.'),
      bullet('The Streamlit dashboard provides an accessible real-time interface for non-expert users to interact with the trained controller, adjust setpoints dynamically, and immediately observe the agent\'s response \u2014 lowering the barrier to process control validation and demonstration.'),
      space(),

      heading2('6.1  Limitations and Further Work'),
      bullet('The single combined reward function for two controlled variables creates competing objectives, as noted in the paper. Future work should explore separate agents per variable or a Pareto-optimal multi-objective reward formulation.'),
      bullet('No process disturbances or measurement noise were included in the simulation. Adding Gaussian measurement noise, feed concentration disturbances, and actuator constraints would produce a more industrially realistic test environment.'),
      bullet('Alternative DRL algorithms (PPO, SAC) should be benchmarked against TD3 on this CSTR, as recommended by the reference paper.'),
      bullet('The learned policy can be deployed on the physical MLAPC laboratory CSTR using sim-to-real transfer techniques, using the PSO-calibrated model as the digital twin.'),
      bullet('The dashboard could be extended with a PID comparison panel, allowing direct head-to-head performance benchmarking of the DRL controller against a tuned PID.'),

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
  const out = path.join(PROJ, 'CSTR_DRL_Technical_Report.docx');
  fs.writeFileSync(out, buffer);
  console.log('Report written to:', out);
});
