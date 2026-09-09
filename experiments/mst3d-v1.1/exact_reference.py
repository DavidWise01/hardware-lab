import json,sys,numpy as np
path=sys.argv[1]
r=json.load(open(path));data=r['referenceInput'];shape=tuple(data['shape']);N=np.prod(shape)
freq=[2*np.pi*np.fft.fftfreq(n,d=d) for n,d in zip(shape,data['spacing'])]
kx,ky,kz=np.meshgrid(*freq,indexing='ij');kinetic=.5*(kx*kx+ky*ky+kz*kz)
# Build H by its action on each basis vector using NumPy's FFT, not JS FFT.
ham=np.zeros((N,N),complex)
for j in range(N):
 basis=np.zeros(N,complex);basis[j]=1
 ham[:,j]=np.fft.ifftn(kinetic*np.fft.fftn(basis.reshape(shape))).ravel()
ham+=np.diag(data['runs'][0]['potential'])
assert np.allclose(ham,ham.conj().T,atol=1e-12)
vals,vecs=np.linalg.eigh(ham)
errors=[]
for run in data['runs']:
 initial=np.array(run['initial']['re'])+1j*np.array(run['initial']['im'])
 observed=np.array(run['output']['re'])+1j*np.array(run['output']['im'])
 target=vecs@(np.exp(-1j*vals*data['time'])*(vecs.conj().T@initial))
 errors.append(float(np.linalg.norm(observed-target)))
ratios=[errors[i]/errors[i+1] for i in range(2)]
c={'id':'C5','name':'Time-step convergence against independent exact discrete Hamiltonian','dt':[.04,.02,.01],'errors':errors,'halving_ratios':ratios,'pass':all(3.8<x<4.2 for x in ratios) and errors[-1]<1e-4}
r['checks'].append(c);r['checks'].sort(key=lambda x:x['id']);r['passed']=sum(x['pass'] for x in r['checks']);r['total']=len(r['checks'])
r['reference_scope']='Same 4x4x4 periodic spatial discretization; exact matrix exponential by Hermitian eigendecomposition. Tests time convergence, not spatial convergence or laboratory accuracy.'
with open(path,'w') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps({'C5':c,'passed':r['passed'],'total':r['total']},indent=2))
