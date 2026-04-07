import { JobDef } from '../world/def-database';

export const JOB_DEFS: JobDef[] = [
  { defId: 'job_haul', label: 'Haul', reportString: 'hauling {target}', workType: 'hauling' },
  { defId: 'job_construct', label: 'Construct', reportString: 'constructing {target}', workType: 'construction' },
  { defId: 'job_mine', label: 'Mine', reportString: 'mining {target}', workType: 'mining' },
  { defId: 'job_harvest', label: 'Harvest', reportString: 'harvesting {target}', workType: 'growing' },
  { defId: 'job_cut_tree', label: 'Cut Tree', reportString: 'cutting {target}', workType: 'growing' },
  { defId: 'job_eat', label: 'Eat', reportString: 'eating', workType: 'personal' },
  { defId: 'job_sleep', label: 'Sleep', reportString: 'sleeping', workType: 'personal' },
  { defId: 'job_wander', label: 'Wander', reportString: 'wandering', workType: 'personal' },
  { defId: 'job_goto', label: 'Go To', reportString: 'going to {target}', workType: 'personal' },
  { defId: 'job_deliver_materials', label: 'Deliver Materials', reportString: 'delivering materials', workType: 'hauling' },
];
