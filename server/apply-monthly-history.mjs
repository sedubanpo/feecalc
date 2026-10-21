// Apply only the new read endpoint to an independently verified deployment source.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const dir=process.argv[2];if(!dir)throw Error('Deployment source directory required');
const file=path.join(dir,'feecalc.js');let source=fs.readFileSync(file,'utf8');
if(!source.includes("['feecalc_monthly_history',")){
 const schema="  ['feecalc_progress',";if(!source.includes(schema))throw Error('Unknown gateway schema');
 const existing=source.split('\n').find(l=>l.includes(schema));
 source="import {readFeeCalcMonthlyHistory} from './feecalcMonthlyHistory.js';\n"+source.replace(existing,existing.replace('feecalc_progress','feecalc_monthly_history')+'\n'+existing);
 const route="      if (rpc === 'feecalc_progress')";if(!source.includes(route))throw Error('Unknown gateway routes');
 source=source.replace(route,"      if (rpc === 'feecalc_monthly_history') return res.status(200).json({data:await readFeeCalcMonthlyHistory(db,decoded.uid,params.p_student_id,params.p_month),error:null});\n"+route);
 fs.writeFileSync(file,source);
}
fs.copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'feecalcMonthlyHistory.js'),path.join(dir,'feecalcMonthlyHistory.js'));
